-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for global pagination (newest first)
CREATE INDEX IF NOT EXISTS idx_products_updated_id 
ON products (updated_at DESC, id DESC);

-- Index for category-filtered pagination (newest first)
CREATE INDEX IF NOT EXISTS idx_products_category_updated_id 
ON products (category, updated_at DESC, id DESC);
