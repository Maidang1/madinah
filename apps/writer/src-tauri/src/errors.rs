pub type AppResult<T> = Result<T, String>;

pub fn to_io_error(error: std::io::Error) -> String {
    error.to_string()
}
