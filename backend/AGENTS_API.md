# Multi-Agent API Contracts

Base URL: `/api/agents`

## 1) Clinical Summary Agent

Endpoint: `POST /api/agents/clinical-summary`

```json
{
  "childName": "Aarav",
  "role": "doctor",
  "screeningReport": {
    "risk_assessment": { "level": "moderate", "confidence": 0.81 },
    "screeningSummary": "Eye gaze inconsistency observed in social tasks."
  }
}
```

### DB-backed Clinical Summary (Recommended for Doctor Portal)

Endpoint: `POST /api/agents/clinical-summary/by-child`

```json
{
  "childId": "uuid",
  "role": "doctor",
  "forceRefresh": false
}
```

Behavior:
- Fetches latest screening report from `screening_results` using `childId`
- Uses cached summary from `clinical_summaries` if available
- Generates new summary and persists cache when needed
- Returns `sourceScreeningId` in response

Response shape:

```json
{
  "data": {
    "overview": "string",
    "keyFindings": ["string"],
    "riskLevel": "string",
    "reviewFlags": ["string"],
    "recommendedNextSteps": ["string"]
  },
  "meta": {
    "generatedBy": "deterministic|gemini",
    "model": "optional-string"
  }
}
```

## 2) Therapy Planning Agent

Endpoint: `POST /api/agents/therapy-planning`

```json
{
  "childName": "Aarav",
  "diagnosis": "ASD",
  "severityLevel": "moderate",
  "ageYears": 5,
  "primaryChallenges": ["Social engagement", "Communication initiation"],
  "constraints": ["Short attention window", "Limited weekday availability"]
}
```

### Therapy Plan Cache Fetch (Therapist Portal)

Endpoint: `POST /api/agents/therapy-planning/by-child`

```json
{
  "childId": "uuid"
}
```

### Therapy Plan Generate (Doctor Trigger After Diagnostic)

Endpoint: `POST /api/agents/therapy-planning/by-child/generate`

```json
{
  "childId": "uuid"
}
```

Response shape:

```json
{
  "data": {
    "overview": "string",
    "weeklyPlan": [
      {
        "week": 1,
        "goals": ["string"],
        "activities": ["string"]
      }
    ],
    "homeStrategies": ["string"],
    "therapistFocus": ["string"],
    "escalationSignals": ["string"]
  },
  "meta": {
    "generatedBy": "deterministic|gemini",
    "model": "optional-string"
  }
}
```

## 3) Monitoring Agent

Endpoint: `POST /api/agents/monitoring-inference`

```json
{
  "childName": "Aarav",
  "role": "therapist",
  "metricSeries": [
    { "metric": "eye_gaze", "previous": 0.32, "current": 0.41, "higherIsBetter": true },
    { "metric": "response_latency", "previous": 4.8, "current": 3.6, "higherIsBetter": false }
  ],
  "therapistSessionFeedback": [
    {
      "sessionDate": "2026-02-18",
      "strengths": ["Good response to visual prompts"],
      "concerns": ["Inconsistent attention in final 10 min"],
      "notes": "Required additional breaks"
    }
  ]
}
```

Response shape:

```json
{
  "data": {
    "overview": "string",
    "metricInsights": ["string"],
    "riskFlags": ["string"],
    "nextActions": ["string"]
  },
  "meta": {
    "generatedBy": "deterministic|gemini",
    "model": "optional-string"
  }
}
```

## 4) Contracts Discovery

Endpoint: `GET /api/agents/contracts`

Use this endpoint to fetch all available agent contracts and endpoint paths at runtime.

## Database Migration

Apply `backend/clinical_summaries.sql` in Supabase SQL editor to enable summary caching.
Apply `backend/therapy_plans.sql` in Supabase SQL editor to enable therapy plan caching.
