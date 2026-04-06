DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'order_items'
          AND column_name = 'product_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE order_items
            ALTER COLUMN product_id TYPE VARCHAR(64)
            USING product_id::text;
    END IF;
END $$;
