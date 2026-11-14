use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;

use crate::{
    error::AppError,
    models::{ListResponse, Property, PropertyDetail, PropertyPayload},
    query,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListPropertiesQuery {
    pub city: Option<String>,
    pub property_type: Option<String>,
    pub listing_type: Option<String>,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
    pub bedrooms: Option<i32>,
    pub availability: Option<String>,
    pub status: Option<String>,
    pub project_id: Option<String>,
    pub search: Option<String>,
    pub order: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListPropertiesQuery>,
) -> Result<Json<ListResponse<Property>>, AppError> {
    let (limit, offset) = query::pagination(query.limit, query.offset);

    let mut params = Vec::new();
    query::select(&mut params, "*");
    query::eq(&mut params, "city", query.city.as_deref());
    query::eq(&mut params, "property_type", query.property_type.as_deref());
    query::eq(&mut params, "listing_type", query.listing_type.as_deref());
    query::eq(&mut params, "availability", query.availability.as_deref());
    query::eq(&mut params, "status", query.status.as_deref());
    query::eq(&mut params, "project_id", query.project_id.as_deref());
    if let Some(price) = query.min_price {
        query::gte(&mut params, "price", Some(&price.to_string()));
    }
    if let Some(price) = query.max_price {
        query::lte(&mut params, "price", Some(&price.to_string()));
    }
    if let Some(bedrooms) = query.bedrooms {
        query::gte(&mut params, "bedrooms", Some(&bedrooms.to_string()));
    }
    query::search(
        &mut params,
        &["title", "city", "locality", "address", "description"],
        query.search.as_deref(),
    );
    query::order(&mut params, query.order.as_deref(), "created_at.desc");
    query::page(&mut params, limit, offset);

    let (value, count) = state.supabase.list("properties", &params).await?;
    let data = serde_json::from_value(value)?;

    Ok(Json(ListResponse {
        data,
        count,
        limit,
        offset,
    }))
}

pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<PropertyPayload>,
) -> Result<Json<Property>, AppError> {
    let title = payload
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::BadRequest("title is required".to_string()))?;
    if payload.property_type.as_deref().unwrap_or("").trim().is_empty() {
        return Err(AppError::BadRequest(
            "property_type is required".to_string(),
        ));
    }
    if payload.price.is_none() {
        return Err(AppError::BadRequest("price is required".to_string()));
    }
    if payload
        .city
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return Err(AppError::BadRequest("city is required".to_string()));
    }
    let _ = title;

    let body = serde_json::to_value(&payload)?;
    let value = state.supabase.insert("properties", &body).await?;
    let mut items: Vec<Property> = serde_json::from_value(value)?;
    items
        .pop()
        .map(Json)
        .ok_or_else(|| AppError::Upstream("insert returned no rows".to_string()))
}

pub async fn update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<PropertyPayload>,
) -> Result<Json<Property>, AppError> {
    let body = serde_json::to_value(&payload)?;
    if body.as_object().map(|map| map.is_empty()).unwrap_or(false) {
        return Err(AppError::BadRequest("nothing to update".to_string()));
    }

    let value = state.supabase.update("properties", &id, &body).await?;
    let mut items: Vec<Property> = serde_json::from_value(value)?;
    items.pop().map(Json).ok_or(AppError::NotFound)
}

pub async fn get_one(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<PropertyDetail>, AppError> {
    let mut params = Vec::new();
    query::select(&mut params, "*,projects(*)");
    params.push(("id".to_string(), format!("eq.{id}")));
    params.push(("limit".to_string(), "1".to_string()));

    let (value, _) = state.supabase.list("properties", &params).await?;
    let mut items: Vec<PropertyDetail> = serde_json::from_value(value)?;

    items.pop().map(Json).ok_or(AppError::NotFound)
}
