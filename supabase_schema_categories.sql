-- Categories (Folders) Table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, name)
);

-- Linksテーブルへのカテゴリ紐付け
ALTER TABLE public.links 
ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- RLS Settings for Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for categories" ON public.categories FOR SELECT USING (true);
