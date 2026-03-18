#!/bin/bash
# Add topicType column and index to Article table
psql -U postgres -d immigrants_data -c 'ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "topicType" TEXT;'
psql -U postgres -d immigrants_data -c 'CREATE INDEX IF NOT EXISTS "Article_topicType_idx" ON "Article"("topicType");'
echo "Migration done"
