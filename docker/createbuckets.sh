#!/bin/sh
# Crea el bucket en SeaweedFS y lo deja con lectura pública
# (la app sirve manifests HLS y thumbnails por URL directa).
set -e

ENDPOINT="${S3_ENDPOINT_INTERNAL:-http://s3:8333}"
BUCKET="${S3_BUCKET:-streamflow}"

echo "Esperando a SeaweedFS en $ENDPOINT..."
until aws --endpoint-url "$ENDPOINT" --region us-east-1 s3api list-buckets >/dev/null 2>&1; do
  sleep 2
done

echo "Creando bucket '$BUCKET'..."
aws --endpoint-url "$ENDPOINT" --region us-east-1 s3api create-bucket --bucket "$BUCKET" >/dev/null 2>&1 || true

echo "Aplicando política de lectura pública..."
aws --endpoint-url "$ENDPOINT" --region us-east-1 s3api put-bucket-policy --bucket "$BUCKET" \
  --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::$BUCKET/*\"]}]}"

echo "Bucket '$BUCKET' listo."
