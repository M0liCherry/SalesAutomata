use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("upstream error: {0}")]
    Upstream(String),
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error(transparent)]
    Serialization(#[from] serde_json::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::Upstream(_) => StatusCode::BAD_GATEWAY,
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Serialization(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let message = self.to_string();
        tracing::warn!(%status, %message, "request failed");

        (status, Json(json!({ "error": message }))).into_response()
    }
}
