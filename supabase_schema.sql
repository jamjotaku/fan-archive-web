-- FanArchive Initial Schema

-- Communities Table
CREATE TABLE public.communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_server_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Links Table
CREATE TABLE public.links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    platform TEXT,
    title TEXT,
    thumbnail_url TEXT,
    metadata_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    published_at TIMESTAMP WITH TIME ZONE,
    added_by_user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (community_id, url)
);

-- Timestamps Table
CREATE TABLE public.timestamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
    time_seconds INTEGER,
    description TEXT,
    discord_message_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Settings
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timestamps ENABLE ROW LEVEL SECURITY;

-- 読み取りはWeb閲覧用に誰でも可能（Publicアクセス）にするポリシー
CREATE POLICY "Public read access for communities" ON public.communities FOR SELECT USING (true);
CREATE POLICY "Public read access for links" ON public.links FOR SELECT USING (true);
CREATE POLICY "Public read access for timestamps" ON public.timestamps FOR SELECT USING (true);
