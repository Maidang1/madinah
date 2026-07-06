use crate::error::AppError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const PROVIDER_CLOUDFLARE_R2_WORKER: &str = "cloudflare-r2-worker";
const SECRET_PLACEHOLDER: &str = "********";
const DEFAULT_PUBLIC_BASE_URL: &str = "https://assets.felixwliu.cn";
const DEFAULT_PREFIX: &str = "images/writer";
const DEFAULT_MAX_BYTES: u64 = 25 * 1024 * 1024;
const MAX_ALLOWED_BYTES: u64 = 500 * 1024 * 1024;
const CACHE_CONTROL_IMMUTABLE: &str = "public, max-age=31536000, immutable";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetUploadSettings {
    pub schema_version: u8,
    pub provider: String,
    pub endpoint: String,
    pub api_key: String,
    pub public_base_url: String,
    pub prefix: String,
    pub max_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetUploadCheckResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetImageUploadInput {
    pub name: String,
    pub content_type: String,
    pub image_data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetImageUploadResult {
    pub key: String,
    pub url: String,
    pub size: u64,
    pub content_type: String,
}

#[tauri::command]
pub fn load_asset_upload_settings(app: tauri::AppHandle) -> Result<AssetUploadSettings, AppError> {
    let settings_path = asset_upload_settings_path(&app)?;
    Ok(mask_asset_upload_secret(
        read_stored_asset_upload_settings_from_path(settings_path)?,
    ))
}

#[tauri::command]
pub fn save_asset_upload_settings(
    settings: AssetUploadSettings,
    app: tauri::AppHandle,
) -> Result<AssetUploadSettings, AppError> {
    let settings_path = asset_upload_settings_path(&app)?;
    save_asset_upload_settings_to_path(settings_path, settings)
}

#[tauri::command]
pub async fn check_asset_upload_settings(
    settings: AssetUploadSettings,
    app: tauri::AppHandle,
) -> Result<AssetUploadCheckResult, AppError> {
    let settings_path = asset_upload_settings_path(&app)?;
    let current = read_stored_asset_upload_settings_from_path(settings_path)
        .unwrap_or_else(|_| default_asset_upload_settings());
    let next = normalize_asset_upload_settings(preserve_placeholder_secret(settings, &current));

    match validate_complete_asset_upload_settings(&next) {
        Ok(()) => match check_worker(&next).await {
            Ok(()) => Ok(AssetUploadCheckResult {
                ok: true,
                message: "Connected".into(),
            }),
            Err(error) => Ok(AssetUploadCheckResult {
                ok: false,
                message: error.to_string(),
            }),
        },
        Err(error) => Ok(AssetUploadCheckResult {
            ok: false,
            message: error.to_string(),
        }),
    }
}

#[tauri::command]
pub async fn upload_asset_image(
    input: AssetImageUploadInput,
    app: tauri::AppHandle,
) -> Result<AssetImageUploadResult, AppError> {
    let settings_path = asset_upload_settings_path(&app)?;
    let settings = read_stored_asset_upload_settings_from_path(settings_path)?;
    validate_complete_asset_upload_settings(&settings)?;
    validate_image_payload(&input, settings.max_bytes)?;

    let (year, month) = current_utc_year_month();
    let key = build_asset_object_key(
        &settings.prefix,
        &input.name,
        &input.content_type,
        &input.image_data,
        year,
        month,
    )?;

    upload_image_to_worker(&settings, &key, &input).await?;

    Ok(AssetImageUploadResult {
        key: key.clone(),
        url: public_asset_url(&settings.public_base_url, &key),
        size: input.image_data.len() as u64,
        content_type: input.content_type,
    })
}

pub fn default_asset_upload_settings() -> AssetUploadSettings {
    AssetUploadSettings {
        schema_version: 2,
        provider: PROVIDER_CLOUDFLARE_R2_WORKER.into(),
        endpoint: String::new(),
        api_key: String::new(),
        public_base_url: DEFAULT_PUBLIC_BASE_URL.into(),
        prefix: DEFAULT_PREFIX.into(),
        max_bytes: DEFAULT_MAX_BYTES,
    }
}

fn asset_upload_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Io(error.to_string()))?
        .join("asset-upload.json"))
}

fn read_stored_asset_upload_settings_from_path(
    settings_path: PathBuf,
) -> Result<AssetUploadSettings, AppError> {
    if !settings_path.exists() {
        return Ok(default_asset_upload_settings());
    }
    let raw = fs::read_to_string(settings_path)?;
    let value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|error| AppError::Io(error.to_string()))?;
    let settings = normalize_asset_upload_settings_from_value(&value);
    validate_safe_asset_upload_settings_shape(&settings)?;
    Ok(settings)
}

fn save_asset_upload_settings_to_path(
    settings_path: PathBuf,
    settings: AssetUploadSettings,
) -> Result<AssetUploadSettings, AppError> {
    let current = read_stored_asset_upload_settings_from_path(settings_path.clone())
        .unwrap_or_else(|_| default_asset_upload_settings());
    let next = normalize_asset_upload_settings(preserve_placeholder_secret(settings, &current));
    validate_safe_asset_upload_settings_shape(&next)?;

    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw =
        serde_json::to_string_pretty(&next).map_err(|error| AppError::Io(error.to_string()))?;
    fs::write(settings_path, raw)?;
    Ok(mask_asset_upload_secret(next))
}

fn normalize_asset_upload_settings_from_value(value: &serde_json::Value) -> AssetUploadSettings {
    let fallback = default_asset_upload_settings();
    let Some(object) = value.as_object() else {
        return fallback;
    };

    AssetUploadSettings {
        schema_version: 2,
        provider: normalize_provider(object.get("provider").and_then(|v| v.as_str())),
        endpoint: normalize_base_url(object.get("endpoint").and_then(|v| v.as_str())),
        api_key: normalize_string(object.get("apiKey").and_then(|v| v.as_str())),
        public_base_url: fallback_if_empty(
            &normalize_base_url(
                object
                    .get("publicBaseUrl")
                    .or_else(|| object.get("customDomain"))
                    .and_then(|v| v.as_str()),
            ),
            DEFAULT_PUBLIC_BASE_URL,
        ),
        prefix: normalize_prefix(&fallback_if_empty(
            &normalize_string(object.get("prefix").and_then(|v| v.as_str())),
            DEFAULT_PREFIX,
        )),
        max_bytes: normalize_max_bytes(object.get("maxBytes"), DEFAULT_MAX_BYTES),
    }
}

fn normalize_asset_upload_settings(settings: AssetUploadSettings) -> AssetUploadSettings {
    AssetUploadSettings {
        schema_version: 2,
        provider: normalize_provider(Some(&settings.provider)),
        endpoint: normalize_base_url(Some(&settings.endpoint)),
        api_key: normalize_string(Some(&settings.api_key)),
        public_base_url: fallback_if_empty(
            &normalize_base_url(Some(&settings.public_base_url)),
            DEFAULT_PUBLIC_BASE_URL,
        ),
        prefix: normalize_prefix(&fallback_if_empty(
            &normalize_string(Some(&settings.prefix)),
            DEFAULT_PREFIX,
        )),
        max_bytes: normalize_max_bytes(
            Some(&serde_json::Value::Number(settings.max_bytes.into())),
            DEFAULT_MAX_BYTES,
        ),
    }
}

fn normalize_provider(value: Option<&str>) -> String {
    match value {
        Some(PROVIDER_CLOUDFLARE_R2_WORKER) => PROVIDER_CLOUDFLARE_R2_WORKER.into(),
        _ => PROVIDER_CLOUDFLARE_R2_WORKER.into(),
    }
}

fn normalize_string(value: Option<&str>) -> String {
    value.unwrap_or("").trim().to_string()
}

fn normalize_base_url(value: Option<&str>) -> String {
    normalize_string(value).trim_end_matches('/').to_string()
}

fn normalize_prefix(value: &str) -> String {
    value
        .trim()
        .replace('\\', "/")
        .trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

fn normalize_max_bytes(value: Option<&serde_json::Value>, fallback: u64) -> u64 {
    let numeric = value
        .and_then(|v| {
            v.as_u64()
                .or_else(|| v.as_f64().map(|number| number.round().max(0.0) as u64))
                .or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok()))
        })
        .unwrap_or(fallback);

    numeric.clamp(1024, MAX_ALLOWED_BYTES)
}

fn fallback_if_empty(value: &str, fallback: &str) -> String {
    if value.trim().is_empty() {
        fallback.into()
    } else {
        value.trim().into()
    }
}

fn preserve_placeholder_secret(
    draft: AssetUploadSettings,
    current: &AssetUploadSettings,
) -> AssetUploadSettings {
    if draft.api_key == SECRET_PLACEHOLDER {
        AssetUploadSettings {
            api_key: current.api_key.clone(),
            ..draft
        }
    } else {
        draft
    }
}

fn mask_asset_upload_secret(settings: AssetUploadSettings) -> AssetUploadSettings {
    if settings.api_key.is_empty() {
        settings
    } else {
        AssetUploadSettings {
            api_key: SECRET_PLACEHOLDER.into(),
            ..settings
        }
    }
}

fn validate_safe_asset_upload_settings_shape(
    settings: &AssetUploadSettings,
) -> Result<(), AppError> {
    if settings.provider != PROVIDER_CLOUDFLARE_R2_WORKER {
        return Err(AppError::Invalid(format!(
            "Unsupported asset upload provider: {}",
            settings.provider
        )));
    }
    if !settings.endpoint.is_empty() && !is_http_url(&settings.endpoint) {
        return Err(AppError::Invalid(
            "Asset upload endpoint must start with http:// or https://".into(),
        ));
    }
    if !is_http_url(&settings.public_base_url) {
        return Err(AppError::Invalid(
            "Public asset URL must start with http:// or https://".into(),
        ));
    }
    sanitize_asset_prefix(&settings.prefix)?;
    Ok(())
}

fn validate_complete_asset_upload_settings(settings: &AssetUploadSettings) -> Result<(), AppError> {
    validate_safe_asset_upload_settings_shape(settings)?;
    if settings.endpoint.is_empty() {
        return Err(AppError::Invalid(
            "Asset upload endpoint is required".into(),
        ));
    }
    if settings.api_key.is_empty() || settings.api_key == SECRET_PLACEHOLDER {
        return Err(AppError::Invalid("Asset upload API key is required".into()));
    }
    Ok(())
}

fn validate_image_payload(input: &AssetImageUploadInput, max_bytes: u64) -> Result<(), AppError> {
    extension_for_content_type(&input.content_type)?;
    if input.image_data.is_empty() {
        return Err(AppError::Invalid("Image payload is empty".into()));
    }
    if input.image_data.len() as u64 > max_bytes {
        return Err(AppError::Invalid(format!(
            "Image is larger than {} bytes",
            max_bytes
        )));
    }
    Ok(())
}

fn sanitize_asset_prefix(prefix: &str) -> Result<String, AppError> {
    let normalized = normalize_prefix(prefix);
    if normalized.is_empty() {
        return Ok(DEFAULT_PREFIX.into());
    }
    for segment in normalized.split('/') {
        if segment == "." || segment == ".." || segment.contains("..") {
            return Err(AppError::Invalid(
                "Asset prefix cannot contain path traversal".into(),
            ));
        }
    }
    Ok(normalized)
}

fn extension_for_content_type(content_type: &str) -> Result<&'static str, AppError> {
    match content_type.trim().to_ascii_lowercase().as_str() {
        "image/png" => Ok("png"),
        "image/jpeg" => Ok("jpg"),
        "image/webp" => Ok("webp"),
        "image/gif" => Ok("gif"),
        _ => Err(AppError::Invalid(format!(
            "Unsupported image type: {}",
            content_type
        ))),
    }
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn build_asset_object_key(
    prefix: &str,
    name: &str,
    content_type: &str,
    bytes: &[u8],
    year: u64,
    month: u64,
) -> Result<String, AppError> {
    let safe_prefix = sanitize_asset_prefix(prefix)?;
    let ext = extension_for_content_type(content_type)?;
    let stem = safe_file_stem(name);
    let hash = image_hash_prefix(bytes);
    Ok(format!(
        "{}/{:04}/{:02}/{}-{}.{}",
        safe_prefix, year, month, hash, stem, ext
    ))
}

fn image_hash_prefix(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    format!("{:x}", digest)[..12].to_string()
}

fn safe_file_stem(name: &str) -> String {
    let normalized = name.replace('\\', "/");
    let basename = normalized.rsplit('/').next().unwrap_or("image").trim();
    let without_extension = basename
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(basename);

    let mut safe = String::new();
    let mut previous_dash = false;
    for character in without_extension.chars() {
        if character.is_ascii_alphanumeric() {
            safe.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            safe.push('-');
            previous_dash = true;
        }
    }

    let trimmed = safe.trim_matches('-');
    if trimmed.is_empty() {
        "image".into()
    } else {
        trimmed.into()
    }
}

fn asset_endpoint_url(endpoint: &str, key: &str) -> String {
    let base_url = endpoint.trim().trim_end_matches('/');
    let path = key
        .trim_start_matches('/')
        .split('/')
        .map(percent_encode_path_segment)
        .collect::<Vec<_>>()
        .join("/");
    format!("{}/{}", base_url, path)
}

fn public_asset_url(base_url: &str, key: &str) -> String {
    format!(
        "{}/{}",
        base_url.trim().trim_end_matches('/'),
        key.trim_start_matches('/')
    )
}

fn percent_encode_path_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.as_bytes() {
        let character = *byte as char;
        if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '~') {
            encoded.push(character);
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}

async fn check_worker(settings: &AssetUploadSettings) -> Result<(), AppError> {
    let client = reqwest::Client::new();
    let response = client
        .get(asset_endpoint_url(&settings.endpoint, "health"))
        .header("x-api-key", &settings.api_key)
        .send()
        .await
        .map_err(|error| AppError::Io(error.to_string()))?;
    assert_asset_upload_response(response, "Asset upload service check failed").await
}

async fn upload_image_to_worker(
    settings: &AssetUploadSettings,
    key: &str,
    input: &AssetImageUploadInput,
) -> Result<(), AppError> {
    let client = reqwest::Client::new();
    let response = client
        .put(asset_endpoint_url(&settings.endpoint, key))
        .header("cache-control", CACHE_CONTROL_IMMUTABLE)
        .header("content-type", &input.content_type)
        .header("x-api-key", &settings.api_key)
        .body(input.image_data.clone())
        .send()
        .await
        .map_err(|error| AppError::Io(error.to_string()))?;
    assert_asset_upload_response(response, "Image upload failed").await
}

async fn assert_asset_upload_response(
    response: reqwest::Response,
    fallback: &str,
) -> Result<(), AppError> {
    if response.status().is_success() {
        return Ok(());
    }
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    let message = if text.trim().is_empty() {
        fallback.to_string()
    } else {
        text.trim().to_string()
    };
    Err(AppError::Invalid(format!(
        "{}: {} {}",
        fallback, status, message
    )))
}

fn current_utc_year_month() -> (u64, u64) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let (year, month, _) = epoch_to_date(secs);
    (year, month)
}

fn epoch_to_date(secs: u64) -> (u64, u64, u64) {
    let days = secs / 86400;
    let mut year = 1970;
    let mut remaining = days;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        year += 1;
    }

    let days_in_months: [u64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for (index, days_in_month) in days_in_months.iter().enumerate() {
        if remaining < *days_in_month {
            month = index as u64 + 1;
            break;
        }
        remaining -= days_in_month;
    }

    (year, month, remaining + 1)
}

fn is_leap_year(year: u64) -> bool {
    (year.is_multiple_of(4) && !year.is_multiple_of(100)) || year.is_multiple_of(400)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn default_settings_use_madinah_worker_defaults() {
        let settings = default_asset_upload_settings();

        assert_eq!(settings.schema_version, 2);
        assert_eq!(settings.provider, "cloudflare-r2-worker");
        assert_eq!(settings.endpoint, "");
        assert_eq!(settings.public_base_url, "https://assets.felixwliu.cn");
        assert_eq!(settings.prefix, "images/writer");
        assert_eq!(settings.max_bytes, 25 * 1024 * 1024);
    }

    #[test]
    fn normalizes_settings_and_clamps_size() {
        let value = serde_json::json!({
            "provider": "cloudflare-r2-worker",
            "endpoint": " https://upload.example.com/ ",
            "apiKey": " key ",
            "publicBaseUrl": "https://assets.example.com/",
            "prefix": "/images/paste/",
            "maxBytes": 1
        });

        let settings = normalize_asset_upload_settings_from_value(&value);

        assert_eq!(settings.endpoint, "https://upload.example.com");
        assert_eq!(settings.api_key, "key");
        assert_eq!(settings.public_base_url, "https://assets.example.com");
        assert_eq!(settings.prefix, "images/paste");
        assert_eq!(settings.max_bytes, 1024);
    }

    #[test]
    fn stores_unmasked_secret_and_returns_masked_settings() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("asset-upload.json");
        let saved = save_asset_upload_settings_to_path(
            path.clone(),
            AssetUploadSettings {
                endpoint: "https://upload.example.com".into(),
                api_key: "key".into(),
                ..default_asset_upload_settings()
            },
        )
        .unwrap();

        assert_eq!(saved.api_key, SECRET_PLACEHOLDER);
        let raw = fs::read_to_string(path).unwrap();
        assert!(raw.contains("\"apiKey\": \"key\""));
    }

    #[test]
    fn preserves_placeholder_secret_on_save() {
        let current = AssetUploadSettings {
            api_key: "stored-key".into(),
            ..default_asset_upload_settings()
        };
        let draft = AssetUploadSettings {
            api_key: SECRET_PLACEHOLDER.into(),
            prefix: "images/new".into(),
            ..default_asset_upload_settings()
        };

        let merged = preserve_placeholder_secret(draft, &current);

        assert_eq!(merged.api_key, "stored-key");
        assert_eq!(merged.prefix, "images/new");
    }

    #[test]
    fn builds_key_with_prefix_date_hash_and_safe_name() {
        let key = build_asset_object_key(
            "images/writer",
            "Hello World!.png",
            "image/png",
            b"image",
            2026,
            7,
        )
        .unwrap();

        assert!(
            regex_lite::Regex::new(r"^images/writer/2026/07/[a-f0-9]{12}-hello-world\.png$")
                .unwrap()
                .is_match(&key)
        );
    }

    #[test]
    fn rejects_invalid_upload_settings_and_payloads() {
        let mut settings = default_asset_upload_settings();
        settings.endpoint = "ftp://upload.example.com".into();
        assert!(validate_safe_asset_upload_settings_shape(&settings)
            .unwrap_err()
            .to_string()
            .contains("http:// or https://"));

        assert!(sanitize_asset_prefix("images/../secret")
            .unwrap_err()
            .to_string()
            .contains("path traversal"));

        let unsupported = AssetImageUploadInput {
            name: "note.txt".into(),
            content_type: "text/plain".into(),
            image_data: vec![1],
        };
        assert!(validate_image_payload(&unsupported, 1024)
            .unwrap_err()
            .to_string()
            .contains("Unsupported image type"));

        let empty = AssetImageUploadInput {
            name: "image.png".into(),
            content_type: "image/png".into(),
            image_data: vec![],
        };
        assert!(validate_image_payload(&empty, 1024)
            .unwrap_err()
            .to_string()
            .contains("empty"));
    }

    #[test]
    fn formats_worker_and_public_urls() {
        assert_eq!(
            asset_endpoint_url("https://upload.example.com/", "images/writer/a b.png"),
            "https://upload.example.com/images/writer/a%20b.png"
        );
        assert_eq!(
            public_asset_url("https://assets.example.com/", "/images/writer/a.png"),
            "https://assets.example.com/images/writer/a.png"
        );
    }
}
