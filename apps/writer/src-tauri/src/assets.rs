use crate::{
    errors::{to_io_error, AppResult},
    files::ensure_dir,
    models::{
        AssetImageUploadInput, AssetImageUploadResult, AssetUploadCheckResult, AssetUploadSettings,
    },
};
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Region, primitives::ByteStream, Client};
use base64::{engine::general_purpose, Engine as _};
use chrono::{Datelike, Utc};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

pub const SECRET_PLACEHOLDER: &str = "********";
const SETTINGS_FILE: &str = "asset-upload.json";
const DEFAULT_BUCKET: &str = "madinah-assets";
const DEFAULT_PUBLIC_BASE_URL: &str = "https://assets.felixwliu.cn";
const DEFAULT_PREFIX: &str = "images/writer";
const DEFAULT_MAX_BYTES: u64 = 25 * 1024 * 1024;
const MAX_ALLOWED_BYTES: u64 = 500 * 1024 * 1024;
const CACHE_CONTROL_IMMUTABLE: &str = "public, max-age=31536000, immutable";

pub fn load_settings(app: &AppHandle) -> AppResult<AssetUploadSettings> {
    load_settings_from_file(&settings_path(app)?)
}

pub fn save_settings(
    app: &AppHandle,
    settings: &AssetUploadSettings,
) -> AppResult<AssetUploadSettings> {
    save_settings_to_file(&settings_path(app)?, settings)
}

pub async fn check_settings(
    app: &AppHandle,
    settings: AssetUploadSettings,
) -> AppResult<AssetUploadCheckResult> {
    let current = read_stored_settings(app).unwrap_or_else(|_| default_settings());
    let next = normalize_settings(preserve_placeholder_secret(settings, &current));

    if let Err(message) = validate_complete_settings(&next) {
        return Ok(AssetUploadCheckResult { ok: false, message });
    }

    let client = r2_client(&next);
    match client.head_bucket().bucket(&next.bucket).send().await {
        Ok(_) => Ok(AssetUploadCheckResult {
            ok: true,
            message: "Connected".to_string(),
        }),
        Err(error) => Ok(AssetUploadCheckResult {
            ok: false,
            message: error.to_string(),
        }),
    }
}

pub async fn upload_image(
    app: &AppHandle,
    input: AssetImageUploadInput,
) -> AppResult<AssetImageUploadResult> {
    let settings = read_stored_settings(app)?;
    validate_complete_settings(&settings)?;
    let bytes = decode_image_payload(&input)?;
    validate_image_payload(&input, bytes.len() as u64, settings.max_bytes)?;

    let now = Utc::now();
    let key = build_object_key(
        &settings.prefix,
        &input.name,
        &input.content_type,
        &bytes,
        now.year(),
        now.month(),
    )?;
    let client = r2_client(&settings);

    client
        .put_object()
        .bucket(&settings.bucket)
        .key(&key)
        .body(ByteStream::from(bytes))
        .content_type(&input.content_type)
        .cache_control(CACHE_CONTROL_IMMUTABLE)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    Ok(AssetImageUploadResult {
        url: public_url(&settings.public_base_url, &key),
        key,
        size: input.size,
        content_type: input.content_type,
    })
}

pub fn default_settings() -> AssetUploadSettings {
    AssetUploadSettings {
        account_id: String::new(),
        bucket: DEFAULT_BUCKET.to_string(),
        access_key_id: String::new(),
        secret_access_key: String::new(),
        public_base_url: DEFAULT_PUBLIC_BASE_URL.to_string(),
        prefix: DEFAULT_PREFIX.to_string(),
        max_bytes: DEFAULT_MAX_BYTES,
    }
}

pub fn load_settings_from_file(path: &Path) -> AppResult<AssetUploadSettings> {
    read_stored_settings_from_path(path).map(mask_secret)
}

pub fn save_settings_to_file(
    path: &Path,
    settings: &AssetUploadSettings,
) -> AppResult<AssetUploadSettings> {
    let current = read_stored_settings_from_path(path).unwrap_or_else(|_| default_settings());
    let next = normalize_settings(preserve_placeholder_secret(settings.clone(), &current));
    validate_safe_settings_shape(&next)?;

    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }

    let json = serde_json::to_string_pretty(&next).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(to_io_error)?;
    set_private_file_permissions(path)?;
    Ok(mask_secret(next))
}

pub fn normalize_settings(settings: AssetUploadSettings) -> AssetUploadSettings {
    let fallback = default_settings();
    AssetUploadSettings {
        account_id: settings.account_id.trim().to_string(),
        bucket: fallback_if_empty(settings.bucket.trim(), &fallback.bucket),
        access_key_id: settings.access_key_id.trim().to_string(),
        secret_access_key: settings.secret_access_key.trim().to_string(),
        public_base_url: fallback_if_empty(
            settings.public_base_url.trim().trim_end_matches('/'),
            &fallback.public_base_url,
        ),
        prefix: fallback_if_empty(
            settings
                .prefix
                .trim()
                .replace('\\', "/")
                .trim_matches('/')
                .trim(),
            &fallback.prefix,
        ),
        max_bytes: settings.max_bytes.clamp(1024, MAX_ALLOWED_BYTES),
    }
}

pub fn preserve_placeholder_secret(
    settings: AssetUploadSettings,
    current: &AssetUploadSettings,
) -> AssetUploadSettings {
    if settings.secret_access_key.trim() == SECRET_PLACEHOLDER {
        return AssetUploadSettings {
            secret_access_key: current.secret_access_key.clone(),
            ..settings
        };
    }

    settings
}

pub fn mask_secret(settings: AssetUploadSettings) -> AssetUploadSettings {
    AssetUploadSettings {
        secret_access_key: if settings.secret_access_key.is_empty() {
            String::new()
        } else {
            SECRET_PLACEHOLDER.to_string()
        },
        ..settings
    }
}

pub fn build_object_key(
    prefix: &str,
    name: &str,
    content_type: &str,
    bytes: &[u8],
    year: i32,
    month: u32,
) -> AppResult<String> {
    let prefix = sanitize_prefix(prefix)?;
    let stem = safe_file_stem(name);
    let extension = extension_for_content_type(content_type)?;
    let digest = Sha256::digest(bytes);
    let hash = digest
        .iter()
        .take(6)
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();

    Ok(format!(
        "{prefix}/{year:04}/{month:02}/{hash}-{stem}.{extension}"
    ))
}

pub fn public_url(base_url: &str, key: &str) -> String {
    format!(
        "{}/{}",
        base_url.trim().trim_end_matches('/'),
        key.trim_start_matches('/')
    )
}

fn read_stored_settings(app: &AppHandle) -> AppResult<AssetUploadSettings> {
    read_stored_settings_from_path(&settings_path(app)?)
}

fn read_stored_settings_from_path(path: &Path) -> AppResult<AssetUploadSettings> {
    if !path.exists() {
        return Ok(default_settings());
    }

    let source = fs::read_to_string(path).map_err(to_io_error)?;
    let settings = serde_json::from_str(&source).map_err(|error| error.to_string())?;
    let settings = normalize_settings(settings);
    validate_safe_settings_shape(&settings)?;
    Ok(settings)
}

fn settings_path(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(SETTINGS_FILE))
        .map_err(|error| error.to_string())
}

fn r2_client(settings: &AssetUploadSettings) -> Client {
    let credentials = Credentials::new(
        settings.access_key_id.clone(),
        settings.secret_access_key.clone(),
        None,
        None,
        "madinah-writer",
    );
    let config = aws_sdk_s3::config::Builder::new()
        .endpoint_url(format!(
            "https://{}.r2.cloudflarestorage.com",
            settings.account_id
        ))
        .region(Region::new("auto"))
        .credentials_provider(credentials)
        .force_path_style(true)
        .build();

    Client::from_conf(config)
}

fn validate_safe_settings_shape(settings: &AssetUploadSettings) -> AppResult<()> {
    sanitize_prefix(&settings.prefix)?;
    if !settings.public_base_url.starts_with("https://")
        && !settings.public_base_url.starts_with("http://")
    {
        return Err("Public asset URL must start with http:// or https://".to_string());
    }
    if settings.account_id.contains('/') || settings.account_id.contains('\\') {
        return Err("Cloudflare account id is invalid".to_string());
    }
    Ok(())
}

fn validate_complete_settings(settings: &AssetUploadSettings) -> AppResult<()> {
    validate_safe_settings_shape(settings)?;
    if settings.account_id.is_empty() {
        return Err("Cloudflare account id is required".to_string());
    }
    if settings.bucket.is_empty() {
        return Err("R2 bucket is required".to_string());
    }
    if settings.access_key_id.is_empty() {
        return Err("R2 access key id is required".to_string());
    }
    if settings.secret_access_key.is_empty() || settings.secret_access_key == SECRET_PLACEHOLDER {
        return Err("R2 secret access key is required".to_string());
    }
    Ok(())
}

fn decode_image_payload(input: &AssetImageUploadInput) -> AppResult<Vec<u8>> {
    general_purpose::STANDARD
        .decode(input.data_base64.trim())
        .map_err(|error| format!("Invalid image payload: {error}"))
}

fn validate_image_payload(
    input: &AssetImageUploadInput,
    decoded_size: u64,
    max_bytes: u64,
) -> AppResult<()> {
    extension_for_content_type(&input.content_type)?;
    if decoded_size == 0 {
        return Err("Image payload is empty".to_string());
    }
    if input.size != decoded_size {
        return Err("Image size changed during upload".to_string());
    }
    if decoded_size > max_bytes {
        return Err(format!("Image is larger than {max_bytes} bytes"));
    }
    Ok(())
}

fn extension_for_content_type(content_type: &str) -> AppResult<&'static str> {
    match content_type.trim().to_ascii_lowercase().as_str() {
        "image/png" => Ok("png"),
        "image/jpeg" => Ok("jpg"),
        "image/webp" => Ok("webp"),
        "image/gif" => Ok("gif"),
        _ => Err(format!("Unsupported image type: {content_type}")),
    }
}

fn sanitize_prefix(prefix: &str) -> AppResult<String> {
    let cleaned = prefix.trim().replace('\\', "/");
    let segments = cleaned
        .trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    if segments.is_empty() {
        return Ok(DEFAULT_PREFIX.to_string());
    }

    for segment in &segments {
        if *segment == "." || *segment == ".." || segment.contains("..") {
            return Err("Asset prefix cannot contain path traversal".to_string());
        }
    }

    Ok(segments.join("/"))
}

fn safe_file_stem(name: &str) -> String {
    let stem = std::path::Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let mut safe = String::new();
    let mut previous_dash = false;

    for character in stem.chars() {
        if character.is_ascii_alphanumeric() {
            safe.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            safe.push('-');
            previous_dash = true;
        }
    }

    let safe = safe.trim_matches('-').to_string();
    if safe.is_empty() {
        "image".to_string()
    } else {
        safe
    }
}

fn fallback_if_empty(value: impl AsRef<str>, fallback: &str) -> String {
    let value = value.as_ref().trim();
    if value.is_empty() {
        fallback.to_string()
    } else {
        value.to_string()
    }
}

fn set_private_file_permissions(path: &Path) -> AppResult<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(to_io_error)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_settings_applies_defaults_and_bounds() {
        let settings = normalize_settings(AssetUploadSettings {
            account_id: " abc ".to_string(),
            bucket: " ".to_string(),
            access_key_id: " key ".to_string(),
            secret_access_key: " secret ".to_string(),
            public_base_url: "https://assets.example.com/".to_string(),
            prefix: "/images/writer/".to_string(),
            max_bytes: 10,
        });

        assert_eq!(settings.account_id, "abc");
        assert_eq!(settings.bucket, DEFAULT_BUCKET);
        assert_eq!(settings.access_key_id, "key");
        assert_eq!(settings.secret_access_key, "secret");
        assert_eq!(settings.public_base_url, "https://assets.example.com");
        assert_eq!(settings.prefix, DEFAULT_PREFIX);
        assert_eq!(settings.max_bytes, 1024);
    }

    #[test]
    fn load_and_save_settings_use_private_json_file() {
        let temp = tempfile::tempdir().expect("temp dir");
        let path = temp.path().join("asset-upload.json");

        let saved = save_settings_to_file(
            &path,
            &AssetUploadSettings {
                account_id: "account".to_string(),
                bucket: "bucket".to_string(),
                access_key_id: "access".to_string(),
                secret_access_key: "secret".to_string(),
                public_base_url: "https://assets.example.com".to_string(),
                prefix: "images/writer".to_string(),
                max_bytes: 2048,
            },
        )
        .expect("save settings");

        assert_eq!(saved.secret_access_key, SECRET_PLACEHOLDER);

        let loaded = load_settings_from_file(&path).expect("load settings");
        assert_eq!(loaded.secret_access_key, SECRET_PLACEHOLDER);

        let source = fs::read_to_string(path).expect("settings json");
        assert!(source.contains("secret"));
    }

    #[test]
    fn placeholder_secret_preserves_current_value() {
        let current = AssetUploadSettings {
            secret_access_key: "current-secret".to_string(),
            ..default_settings()
        };
        let next = preserve_placeholder_secret(
            AssetUploadSettings {
                secret_access_key: SECRET_PLACEHOLDER.to_string(),
                ..default_settings()
            },
            &current,
        );

        assert_eq!(next.secret_access_key, "current-secret");
        assert_eq!(mask_secret(next).secret_access_key, SECRET_PLACEHOLDER);
    }

    #[test]
    fn build_object_key_uses_prefix_date_hash_and_safe_name() {
        let key = build_object_key(
            "images/writer",
            "Screen Shot 01.PNG",
            "image/png",
            b"image-bytes",
            2026,
            6,
        )
        .expect("key");

        assert_eq!(key, "images/writer/2026/06/2c8648d103e3-screen-shot-01.png");
    }

    #[test]
    fn build_object_key_rejects_path_traversal_prefix() {
        let error = build_object_key("../images", "image.png", "image/png", b"x", 2026, 6)
            .expect_err("invalid prefix");

        assert!(error.contains("path traversal"));
    }

    #[test]
    fn public_url_joins_base_and_key() {
        assert_eq!(
            public_url("https://assets.example.com/", "/images/a.png"),
            "https://assets.example.com/images/a.png"
        );
    }

    #[test]
    fn validate_image_payload_covers_type_size_and_base64() {
        let input = AssetImageUploadInput {
            name: "image.png".to_string(),
            content_type: "image/png".to_string(),
            size: 4,
            data_base64: general_purpose::STANDARD.encode([1, 2, 3, 4]),
        };
        let decoded = decode_image_payload(&input).expect("decode");

        validate_image_payload(&input, decoded.len() as u64, 4).expect("valid");

        let bad_type = AssetImageUploadInput {
            content_type: "text/plain".to_string(),
            ..input.clone()
        };
        assert!(validate_image_payload(&bad_type, 4, 4)
            .expect_err("bad type")
            .contains("Unsupported image type"));

        assert!(validate_image_payload(&input, 4, 3)
            .expect_err("large")
            .contains("larger"));
    }
}
