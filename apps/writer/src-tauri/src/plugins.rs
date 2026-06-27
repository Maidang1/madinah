use crate::{
    errors::{to_io_error, AppResult},
    files::ensure_dir,
    models::{
        ResolvedPlugin, TrustRecord, TrustedPluginBundle, TrustedPluginBundleInput,
    },
    workspace::read_workspace_config,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

pub use crate::models::TrustInput;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackageManifest {
    name: Option<String>,
    version: Option<String>,
    madinah_writer: Option<PluginManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginManifest {
    api_version: u32,
    entry: String,
    #[serde(default)]
    capabilities: Vec<String>,
}

pub fn resolve_workspace_plugins_from_root_with_trust(
    workspace_root: &Path,
    trust_path: Option<&Path>,
) -> AppResult<Vec<ResolvedPlugin>> {
    let config = read_workspace_config(workspace_root)?;
    config
        .plugins
        .iter()
        .map(|spec| resolve_plugin(workspace_root, spec, trust_path))
        .collect()
}

pub fn set_plugin_trust_in_file(path: &Path, input: TrustInput) -> AppResult<TrustRecord> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }

    let mut records = read_trust_records(path)?;
    let record = TrustRecord {
        workspace_root: input.workspace_root,
        package_id: input.package_id,
        version: input.version,
        bundle_hash: input.bundle_hash,
        trusted: input.trusted,
        updated_at: unix_timestamp_string(),
    };

    records.retain(|item| {
        item.workspace_root != record.workspace_root
            || item.package_id != record.package_id
            || item.version != record.version
    });
    records.push(record.clone());

    let json = serde_json::to_string_pretty(&records).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(to_io_error)?;
    Ok(record)
}

pub fn read_trusted_plugin_bundle_from_file(
    trust_path: &Path,
    input: &TrustedPluginBundleInput,
) -> AppResult<TrustedPluginBundle> {
    let trusted = is_trusted(
        trust_path,
        &input.workspace_root,
        &input.package_id,
        &input.version,
        &input.bundle_hash,
    )?;
    if !trusted {
        return Err(format!("Plugin {} is not trusted", input.package_id));
    }

    let entry_path = Path::new(&input.entry_path);
    let code = fs::read_to_string(entry_path).map_err(to_io_error)?;
    let hash = hash_bytes(code.as_bytes());
    if hash != input.bundle_hash {
        return Err(format!("Plugin bundle hash changed: {}", input.package_id));
    }

    Ok(TrustedPluginBundle { code, hash })
}

pub fn trust_path(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("plugins").join("trust.json"))
        .map_err(|error| error.to_string())
}

fn resolve_plugin(
    workspace_root: &Path,
    spec: &str,
    trust_path: Option<&Path>,
) -> AppResult<ResolvedPlugin> {
    let package_root = resolve_package_root(workspace_root, spec);
    let manifest_path = package_root.join("package.json");
    let manifest_source = fs::read_to_string(&manifest_path).map_err(to_io_error)?;
    let manifest: PackageManifest =
        serde_json::from_str(&manifest_source).map_err(|error| error.to_string())?;
    let plugin_manifest = manifest
        .madinah_writer
        .ok_or_else(|| format!("Missing madinahWriter manifest: {}", manifest_path.display()))?;

    if plugin_manifest.api_version != 1 {
        return Err(format!(
            "Unsupported plugin apiVersion {}: {}",
            plugin_manifest.api_version,
            manifest_path.display()
        ));
    }

    let entry_path = package_root.join(&plugin_manifest.entry);
    let bundle = fs::read(&entry_path).map_err(to_io_error)?;
    let bundle_hash = hash_bytes(&bundle);
    let package_id = manifest.name.unwrap_or_else(|| spec.to_string());
    let version = manifest.version.unwrap_or_else(|| "0.0.0".to_string());
    let workspace_root_string = workspace_root.to_string_lossy().to_string();
    let trusted = trust_path
        .map(|path| {
            is_trusted(
                path,
                &workspace_root_string,
                &package_id,
                &version,
                &bundle_hash,
            )
        })
        .transpose()?
        .unwrap_or(false);

    Ok(ResolvedPlugin {
        id: package_id.clone(),
        package_id,
        name: spec.to_string(),
        version,
        workspace_root: workspace_root.to_path_buf(),
        package_root,
        entry_path,
        bundle_hash,
        trusted,
        capabilities: plugin_manifest.capabilities,
    })
}

fn resolve_package_root(workspace_root: &Path, spec: &str) -> PathBuf {
    let spec_path = Path::new(spec);
    if spec_path.is_absolute() {
        return spec_path.to_path_buf();
    }

    if spec.starts_with('.') {
        return workspace_root.join(spec_path);
    }

    workspace_root.join("node_modules").join(spec_path)
}

fn is_trusted(
    trust_path: &Path,
    workspace_root: &str,
    package_id: &str,
    version: &str,
    bundle_hash: &str,
) -> AppResult<bool> {
    Ok(read_trust_records(trust_path)?.iter().any(|record| {
        record.workspace_root == workspace_root
            && record.package_id == package_id
            && record.version == version
            && record.bundle_hash == bundle_hash
            && record.trusted
    }))
}

fn read_trust_records(path: &Path) -> AppResult<Vec<TrustRecord>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let source = fs::read_to_string(path).map_err(to_io_error)?;
    serde_json::from_str(&source).map_err(|error| error.to_string())
}

fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn unix_timestamp_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
