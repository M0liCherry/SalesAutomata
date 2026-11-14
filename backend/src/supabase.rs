use std::time::Duration;

use reqwest::{Client, RequestBuilder, Response};
use serde_json::Value;

use crate::error::AppError;

pub struct Supabase {
    http: Client,
    base_url: String,
    key: String,
}

impl Supabase {
    pub fn new(base_url: String, key: String) -> anyhow::Result<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("salesautomata-backend/0.1")
            .build()?;

        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            key,
        })
    }

    fn endpoint(&self, table: &str) -> String {
        format!("{}/rest/v1/{}", self.base_url, table)
    }

    fn authed(&self, request: RequestBuilder) -> RequestBuilder {
        request
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
    }

    pub async fn list(
        &self,
        table: &str,
        params: &[(String, String)],
    ) -> Result<(Value, Option<i64>), AppError> {
        let response = self
            .authed(self.http.get(self.endpoint(table)).query(params))
            .header("Prefer", "count=exact")
            .send()
            .await
            .map_err(network_error)?;

        let count = parse_content_range(&response);
        let value = decode(response).await?;
        Ok((value, count))
    }

    pub async fn count(&self, table: &str, params: &[(String, String)]) -> Result<i64, AppError> {
        let mut params = params.to_vec();
        params.push(("select".to_string(), "id".to_string()));

        let response = self
            .authed(self.http.get(self.endpoint(table)).query(&params))
            .header("Prefer", "count=exact")
            .header("Range", "0-0")
            .send()
            .await
            .map_err(network_error)?;

        let count = parse_content_range(&response);
        decode(response).await?;
        Ok(count.unwrap_or(0))
    }

    pub async fn insert(&self, table: &str, payload: &Value) -> Result<Value, AppError> {
        let response = self
            .authed(
                self.http
                    .post(self.endpoint(table))
                    .header("Content-Type", "application/json")
                    .header("Prefer", "return=representation")
                    .json(payload),
            )
            .send()
            .await
            .map_err(network_error)?;

        decode(response).await
    }

    pub async fn update(
        &self,
        table: &str,
        id: &str,
        payload: &Value,
    ) -> Result<Value, AppError> {
        let params = [("id".to_string(), format!("eq.{id}"))];

        let response = self
            .authed(
                self.http
                    .patch(self.endpoint(table))
                    .query(&params)
                    .header("Content-Type", "application/json")
                    .header("Prefer", "return=representation")
                    .json(payload),
            )
            .send()
            .await
            .map_err(network_error)?;

        decode(response).await
    }

    pub async fn health(&self) -> Result<(), AppError> {
        let params = [
            ("select".to_string(), "id".to_string()),
            ("limit".to_string(), "1".to_string()),
        ];
        self.list("agents", &params).await.map(|_| ())
    }
}

fn network_error(error: reqwest::Error) -> AppError {
    AppError::Upstream(format!("network error: {error}"))
}

fn parse_content_range(response: &Response) -> Option<i64> {
    response
        .headers()
        .get("content-range")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.rsplit('/').next())
        .and_then(|value| value.parse().ok())
}

async fn decode(response: Response) -> Result<Value, AppError> {
    let status = response.status();
    let body = response.text().await.map_err(network_error)?;

    if !status.is_success() {
        let snippet: String = body.chars().take(500).collect();
        return Err(AppError::Upstream(format!(
            "supabase returned {}: {snippet}",
            status.as_u16()
        )));
    }

    serde_json::from_str(&body).map_err(AppError::from)
}
