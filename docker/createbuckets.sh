#!/bin/sh
# Crea el bucket en SeaweedFS. La lectura pública queda acotada a los
# artefactos HLS (assets/*/hls/*): downloads, thumbnails y segments.
# El resto (uploads/*, el original) permanece privado y respeta allowDownload.
set -e

ENDPOINT="${S3_ENDPOINT_INTERNAL:-http://s3:8333}"
BUCKET="${S3_BUCKET:-streamflow}"

echo "Esperando a SeaweedFS en $ENDPOINT..."
until aws --endpoint-url "$ENDPOINT" --region us-east-1 s3api list-buckets >/dev/null 2>&1; do
  sleep 2
done

echo "Creando bucket '$BUCKET'..."
aws --endpoint-url "$ENDPOINT" --region us-east-1 s3api create-bucket --bucket "$BUCKET" >/dev/null 2>&1 || true

echo "Aplicando política de lectura pública (solo artefactos HLS)..."
aws --endpoint-url "$ENDPOINT" --region us-east-1 s3api put-bucket-policy --bucket "$BUCKET" \
  --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::$BUCKET/assets/*/hls/*\"]}]}"

echo "Bucket '$BUCKET' listo."
