FROM node:22-bookworm-slim

ENV ENGINE_PYTHON=/opt/venv/bin/python \
    NODE_ENV=production \
    PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY pyproject.toml README.md ./
COPY clinical_nlp ./clinical_nlp
RUN python3 -m venv /opt/venv \
  && python -m pip install --no-cache-dir --upgrade pip \
  && python -m pip install --no-cache-dir "pydantic==2.13.4" "hatchling>=1.25" "editables>=0.5" \
  && python -m pip install --no-cache-dir --no-deps --no-build-isolation -e .

COPY . .
RUN npm run build

EXPOSE 4173

CMD ["npm", "run", "start"]
