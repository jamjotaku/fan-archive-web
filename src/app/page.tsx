import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// モックフォールバック（環境変数が未設定の場合ビルドが通るようにする）
const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseKey || 'dummy-key'
);

export default async function Home({ searchParams }: { searchParams: { page?: string } }) {
  const page = parseInt(searchParams?.page || '1');
  const limit = 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let links = [];
  if (supabaseUrl && supabaseKey) {
    const { data } = await supabase
      .from('links')
      .select('*, timestamps(*)')
      .order('created_at', { ascending: false })
      .range(from, to);
    links = data || [];
  }

  // タイムスタンプ付きURLを生成するヘルパー関数
  const getTimestampUrl = (baseUrl: string, seconds: number | null) => {
    if (!seconds) return baseUrl;
    try {
      const urlObj = new URL(baseUrl);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        urlObj.searchParams.set('t', `${seconds}s`);
      }
      return urlObj.toString();
    } catch {
      return baseUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
          FanArchive
        </h1>
        <p className="text-gray-400">Discord Archive Viewer</p>
      </header>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {links?.map((link: any) => (
          <div key={link.id} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-700 hover:border-gray-500 transition-all duration-300 flex flex-col">
            
            {/* 動画サムネイル/OGP */}
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="h-48 bg-gray-950 relative group cursor-pointer block shrink-0">
              {link.thumbnail_url ? (
                <img src={link.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-600 font-medium">
                   {link.metadata_status === 'pending' ? 'Fetching Info...' : 'Video Thumbnail'}
                </div>
              )}
              {/* 再生ボタン風の装飾 */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-black shadow-lg pl-1">▶</div>
              </div>
            </a>
            
            <div className="p-5 flex-grow">
              <h2 className="text-lg font-bold mb-2 line-clamp-2 leading-tight">
                {link.title || link.url}
              </h2>
              <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded mb-4">
                {link.platform || 'Link'}
              </span>
              
              <div className="space-y-3 mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Timestamps</h3>
                {link.timestamps?.map((ts: any) => (
                  <a 
                    key={ts.id} 
                    href={getTimestampUrl(link.url, ts.time_seconds)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-gray-900/50 p-3 rounded flex gap-3 items-start group hover:bg-gray-700/80 transition-colors block border border-transparent hover:border-gray-600"
                  >
                    <span className="text-blue-400 font-mono text-sm shrink-0 bg-blue-400/10 px-2 py-0.5 rounded">
                      {ts.time_seconds ? new Date(ts.time_seconds * 1000).toISOString().substring(11, 19) : '00:00:00'}
                    </span>
                    <span className="text-gray-300 text-sm line-clamp-2 group-hover:text-white transition-colors">{ts.description}</span>
                  </a>
                ))}
                {!link.timestamps?.length && (
                  <p className="text-gray-500 text-sm">No timestamps recorded.</p>
                )}
              </div>
            </div>

          </div>
        ))}
        {links.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-12 bg-gray-800/50 rounded-xl border border-gray-800">
            {(!supabaseUrl || !supabaseKey) 
              ? 'Supabaseの環境変数(.env)が設定されていません。'
              : 'アーカイブがまだありません。Discordで 📌 リアクションを付けて追加してください。'
            }
          </div>
        )}
      </div>

      <div className="mt-12 flex justify-center gap-4">
        {page > 1 && (
            <a href={`/?page=${page - 1}`} className="px-6 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition text-sm font-medium text-gray-300">
              Previous
            </a>
        )}
        <a href={`/?page=${page + 1}`} className="px-6 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition text-sm font-medium text-gray-300">
          Next
        </a>
      </div>
    </div>
  );
}
