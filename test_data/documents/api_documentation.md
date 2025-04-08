# Workstream API Documentation

## Overview

The Workstream API allows you to integrate our HR, hiring, and payroll functionality into your existing systems. This document provides details on authentication, endpoints, and example requests.

## Authentication

All API requests require an API key that should be included in the header:

```
Authorization: Bearer YOUR_API_KEY
```

To obtain an API key, contact your Workstream account manager or visit the developer settings in your dashboard.

## Base URL

```
https://api.workstream.us/v1
```

## Endpoints

### Applicants

#### GET /applicants

Retrieve a list of applicants with optional filtering.

**Parameters:**
- `status` (optional): Filter by application status (applied, screening, interviewing, hired, rejected)
- `location_id` (optional): Filter by location ID
- `position_id` (optional): Filter by position ID
- `from_date` (optional): Filter by application date (YYYY-MM-DD)
- `to_date` (optional): Filter by application date (YYYY-MM-DD)
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```
GET https://api.workstream.us/v1/applicants?status=interviewing&limit=20
```

#### POST /applicants

Create a new applicant record.

**Parameters:**
- `first_name` (required): Applicant's first name
- `last_name` (required): Applicant's last name
- `email` (required): Applicant's email address
- `phone` (required): Applicant's phone number
- `position_id` (required): ID of the position
- `location_id` (required): ID of the location
- `resume` (optional): Resume file (PDF, DOC, DOCX)
- `cover_letter` (optional): Cover letter text
- `custom_fields` (optional): Object containing custom field values

### Positions

#### GET /positions

Retrieve a list of open positions.

**Parameters:**
- `location_id` (optional): Filter by location ID
- `status` (optional): Filter by status (open, closed, draft)
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

### Employees

#### GET /employees

Retrieve a list of employees.

**Parameters:**
- `location_id` (optional): Filter by location ID
- `status` (optional): Filter by status (active, terminated, on_leave)
- `department` (optional): Filter by department
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

### Payroll

#### GET /payroll/runs

Retrieve a list of payroll runs.

**Parameters:**
- `status` (optional): Filter by status (pending, processing, completed, failed)
- `from_date` (optional): Filter by run date (YYYY-MM-DD)
- `to_date` (optional): Filter by run date (YYYY-MM-DD)
- `limit` (optional): Number of results to return (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

## Rate Limits

The API is rate-limited to 100 requests per minute per API key. If you exceed this limit, you'll receive a 429 Too Many Requests response.

## Error Codes

- `400`: Bad Request - The request was invalid
- `401`: Unauthorized - Invalid API key
- `403`: Forbidden - You don't have permission to access this resource
- `404`: Not Found - The resource was not found
- `429`: Too Many Requests - You've exceeded the rate limit
- `500`: Internal Server Error - Something went wrong on our end

## Webhooks

Workstream can send webhooks to notify your systems of events in real-time. Available webhook events include:

- `applicant.created`: When a new applicant submits an application
- `applicant.status_changed`: When an applicant's status changes
- `employee.hired`: When an applicant is converted to an employee
- `employee.terminated`: When an employee is terminated
- `payroll.completed`: When a payroll run is completed

To configure webhooks, visit the Integrations section of your Workstream dashboard.

*Note: This documentation is for internal testing purposes only.*