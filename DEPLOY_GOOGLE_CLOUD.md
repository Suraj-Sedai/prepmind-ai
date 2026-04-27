# Deploy PrepMind AI to Google Cloud

This repo is set up for a single-service deployment on Google Cloud Run:

- FastAPI serves the API
- the built React frontend is served by the same container
- Cloud SQL stores application data
- a Cloud Storage bucket is mounted into Cloud Run for uploaded files

## What was added to the repo

- `Dockerfile`: multi-stage build for frontend + backend
- `cloudbuild.yaml`: build and deploy to Cloud Run
- backend static frontend serving in `backend/app/main.py`
- PostgreSQL driver support in `backend/requirements.txt`

## Recommended Google Cloud architecture

- Cloud Run for the web app
- Artifact Registry for container images
- Cloud SQL for PostgreSQL for the database
- Cloud Storage bucket mounted into Cloud Run for uploads
- Secret Manager for the session secret

## 1. Set your variables

Use Cloud Shell or a local machine with the Google Cloud CLI installed.

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export SERVICE_NAME="prepmind-ai"
export AR_REPOSITORY="prepmind-ai"
export BUCKET_NAME="prepmind-ai-uploads"
export SQL_INSTANCE="prepmind-ai-db"
export SQL_DB="prepmind"
export SQL_USER="prepmind_user"
export SESSION_SECRET_NAME="prepmind-session-secret"
```

## 2. Enable the required APIs

```bash
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

## 3. Create Artifact Registry

```bash
gcloud artifacts repositories create "$AR_REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="PrepMind AI images"
```

If it already exists, Google Cloud will tell you and you can keep going.

## 4. Create the uploads bucket

```bash
gcloud storage buckets create "gs://$BUCKET_NAME" --location="$REGION"
```

## 5. Create the session secret

Generate a strong random secret, then store it in Secret Manager.

```bash
openssl rand -base64 32 | gcloud secrets create "$SESSION_SECRET_NAME" --data-file=-
```

If the secret already exists, add a new version instead:

```bash
openssl rand -base64 32 | gcloud secrets versions add "$SESSION_SECRET_NAME" --data-file=-
```

## 6. Create Cloud SQL for PostgreSQL

Create the instance in the same region as Cloud Run.

Example template:

```bash
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --region="$REGION" \
  --tier="db-custom-1-3840"
```

Then create the database:

```bash
gcloud sql databases create "$SQL_DB" --instance="$SQL_INSTANCE"
```

Create the database user:

```bash
gcloud sql users create "$SQL_USER" \
  --instance="$SQL_INSTANCE" \
  --password="choose-a-strong-password"
```

Get the instance connection name:

```bash
gcloud sql instances describe "$SQL_INSTANCE" --format="value(connectionName)"
```

Build the SQLAlchemy connection string using the Cloud SQL Unix socket path:

```text
postgresql+psycopg://DB_USER:DB_PASSWORD@/DB_NAME?host=/cloudsql/PROJECT:REGION:INSTANCE
```

Example:

```text
postgresql+psycopg://prepmind_user:YOUR_PASSWORD@/prepmind?host=/cloudsql/your-project:us-central1:prepmind-ai-db
```

## 7. Deploy with Cloud Build

The repo includes `cloudbuild.yaml`. You can deploy without editing the file by passing substitutions:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _REGION="$REGION",_SERVICE_NAME="$SERVICE_NAME",_AR_REPOSITORY="$AR_REPOSITORY",_UPLOAD_BUCKET="$BUCKET_NAME",_INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')",_DATABASE_URL="postgresql+psycopg://$SQL_USER:YOUR_PASSWORD@/$SQL_DB?host=/cloudsql/$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')",_SESSION_SECRET_NAME="$SESSION_SECRET_NAME"
```

## 8. Open the deployed app

```bash
gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format='value(status.url)'
```

That URL serves both the frontend and backend.

## Notes

- The frontend is served from the same Cloud Run service, so you do not need a separate hosting service for the React app.
- Uploaded files are stored in the mounted Cloud Storage bucket at `/mnt/uploads`.
- The deployment file sets `PREPMIND_SESSION_HTTPS_ONLY=true` for production cookies.
- If you want model-backed answers, add `PREPMIND_OPENAI_API_KEY` separately in Cloud Run after deployment.

## Optional: connect GitHub to automatic deploys

Because your repo already lives at:

- `https://github.com/Suraj-Sedai/prepmind-ai`

you can create a Cloud Build trigger in Google Cloud and point it at this repo. Use `cloudbuild.yaml` as the build config and supply the same substitutions there.
