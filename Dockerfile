ARG NODE_IMAGE=node:22-bookworm-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

FROM ${NODE_IMAGE} AS node-build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS python-build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY clinical_nlp ./clinical_nlp
RUN python3 -m venv /opt/build-venv \
  && /opt/build-venv/bin/python -m pip install --no-cache-dir --upgrade pip \
  && /opt/build-venv/bin/python -m pip install --no-cache-dir "hatchling>=1.25" \
  && /opt/build-venv/bin/python -m pip wheel --no-cache-dir --no-deps --no-build-isolation -w /tmp/wheels .

FROM ${NODE_IMAGE} AS runtime

ENV ENGINE_PYTHON=/opt/venv/bin/python \
    NODE_ENV=production \
    PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY server.mjs ./server.mjs
COPY server ./server
COPY --from=node-build /app/dist ./dist
COPY --from=node-build /app/src/lib/clinical-extraction/ml/riskModelArtifact.json ./src/lib/clinical-extraction/ml/riskModelArtifact.json
COPY --from=python-build /tmp/wheels /tmp/wheels

RUN python3 -m venv /opt/venv \
  && python -m pip install --no-cache-dir --upgrade pip \
  && python -m pip install --no-cache-dir "pydantic==2.13.4" /tmp/wheels/*.whl \
  && rm -rf /tmp/wheels

EXPOSE 4173

CMD ["npm", "run", "start"]
