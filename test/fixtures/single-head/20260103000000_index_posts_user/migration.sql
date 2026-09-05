CREATE INDEX "posts_user_id_idx" ON "posts" ("user_id");
DO $$ BEGIN RAISE NOTICE '; not a separator'; END $$;
