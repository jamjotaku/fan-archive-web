"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseKey || 'dummy-key');

export default function Home() {
  const [links, setLinks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Category Editing State
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryIcon, setEditCategoryIcon] = useState('');

  const limit = 20;

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [selectedCategory, page]);

  const fetchCategories = async () => {
    if (!supabaseUrl) return;
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchLinks = async () => {
    if (!supabaseUrl) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('links')
      .select('*, timestamps(*), categories(name, icon)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    const { data } = await query;
    setLinks(data || []);
    setIsLoading(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    const { data: community } = await supabase.from('communities').select('id').limit(1).single();
    if (!community) {
        alert("Discordコミュニティが見つかりません。先にBotを使ってリンクを1つ保存してください。");
        return;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({ community_id: community.id, name: newCategoryName.trim(), icon: newCategoryIcon.trim() || '📁' })
      .select().single();

    if (error) {
      alert("エラー: " + error.message);
    } else if (data) {
      setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoryName('');
      setNewCategoryIcon('');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCategoryName.trim()) return;

    const { error } = await supabase
      .from('categories')
      .update({ name: editCategoryName.trim(), icon: editCategoryIcon.trim() || '📁' })
      .eq('id', editingCategory);

    if (error) {
      alert("更新エラー: " + error.message);
    } else {
      setCategories(categories.map(c => c.id === editingCategory ? { ...c, name: editCategoryName.trim(), icon: editCategoryIcon.trim() || '📁' } : c));
      setEditingCategory(null);
      fetchLinks(); // リンク側の表示も更新
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("本当にこのフォルダを削除しますか？\n※中に入っているアーカイブは「未分類」に移動します。")) return;
    
    // リンクを未分類に移動
    await supabase.from('links').update({ category_id: null }).eq('category_id', categoryId);
    
    // カテゴリを削除
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    
    if (error) {
      alert("削除エラー: " + error.message);
    } else {
      setCategories(categories.filter(c => c.id !== categoryId));
      if (selectedCategory === categoryId) setSelectedCategory(null);
      fetchLinks();
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm("本当に削除しますか？")) return;
    const { error } = await supabase.from('links').delete().eq('id', linkId);
    if (error) alert("削除エラー: " + error.message);
    else setLinks(links.filter(l => l.id !== linkId));
    setOpenDropdown(null);
  };

  const handleMoveCategory = async (linkId: string, newCategoryId: string | null) => {
    const { error } = await supabase.from('links').update({ category_id: newCategoryId }).eq('id', linkId);
    if (error) alert("移動エラー: " + error.message);
    else fetchLinks();
    setOpenDropdown(null);
  };

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

  const getPlatform = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) return 'YouTube';
      if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) return 'X (Twitter)';
      return 'Link';
    } catch {
      return 'Link';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col md:flex-row">
      
      {/* サイドバー（フォルダ一覧） */}
      <aside className="w-full md:w-80 bg-gray-950 p-6 border-r border-gray-800 shrink-0 flex flex-col h-auto md:h-screen md:sticky top-0 z-10" onClick={() => setOpenDropdown(null)}>
        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-8 tracking-wide">
          FanArchive
        </h1>
        
        <div className="mb-8 flex-grow overflow-y-auto pr-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Folders</h2>
          <ul className="space-y-1">
            <li>
              <button 
                onClick={() => { setSelectedCategory(null); setPage(1); }}
                className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium ${selectedCategory === null ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'}`}
              >
                🗂️ All Archives
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id} className="relative group/cat">
                <button 
                  onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium truncate pr-10 ${selectedCategory === cat.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'}`}
                >
                  {cat.icon || '📁'} {cat.name}
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === `cat-${cat.id}` ? null : `cat-${cat.id}`); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                  >
                    ⋮
                  </button>
                  {openDropdown === `cat-${cat.id}` && (
                    <div className="absolute right-0 mt-1 w-32 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1 z-30" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setEditingCategory(cat.id); setEditCategoryName(cat.name); setEditCategoryIcon(cat.icon || '📁'); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition-colors">✏️ 編集</button>
                      <div className="h-px bg-gray-700 my-1"></div>
                      <button onClick={() => { handleDeleteCategory(cat.id); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors">🗑️ 削除</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-6 border-t border-gray-800">
          <form onSubmit={handleCreateCategory} className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Folder</label>
            <div className="flex gap-2 relative">
              <input 
                type="text" 
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value)}
                placeholder="📁" 
                maxLength={2}
                className="w-12 bg-gray-900 border border-gray-700 rounded-lg px-2 py-2.5 text-center text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600"
              />
              <input 
                type="text" 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Name (e.g. Vtuber-A)" 
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-500/20">
                Add
              </button>
            </div>
          </form>
        </div>
      </aside>

      {/* メインコンテンツ（アーカイブ一覧） */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto" onClick={() => setOpenDropdown(null)}>
        <header className="mb-10 flex items-center justify-between border-b border-gray-800 pb-6">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {selectedCategory ? (
              <>
                <span>{categories.find(c => c.id === selectedCategory)?.icon || '📁'}</span>
                <span>{categories.find(c => c.id === selectedCategory)?.name}</span>
              </>
            ) : '🗂️ All Archives'}
          </h2>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
              {links?.map((link: any) => {
                const platform = getPlatform(link.url);
                const isYouTube = platform === 'YouTube';
                const isTwitter = platform === 'X (Twitter)';
                const hoverBorderClass = isYouTube ? 'hover:border-red-500/60' : isTwitter ? 'hover:border-blue-500/60' : 'hover:border-gray-500';

                return (
                  <div key={link.id} className={`bg-gray-800/80 backdrop-blur-sm rounded-2xl overflow-visible shadow-xl border border-gray-700 ${hoverBorderClass} transition-all duration-300 flex flex-col group relative`}>
                    
                    {/* ドロップダウンメニュー */}
                    <div className="absolute top-3 right-3 z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === link.id ? null : link.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-colors border border-gray-600/50"
                      >
                        ⋮
                      </button>
                      {openDropdown === link.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1 z-30" onClick={(e) => e.stopPropagation()}>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Move to...</div>
                          <button onClick={() => handleMoveCategory(link.id, null)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition-colors">🗂️ 未分類 (All)</button>
                          {categories.map(cat => (
                            <button key={cat.id} onClick={() => handleMoveCategory(link.id, cat.id)} className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm transition-colors truncate">{cat.icon || '📁'} {cat.name}</button>
                          ))}
                          <div className="h-px bg-gray-700 my-1"></div>
                          <button onClick={() => handleDelete(link.id)} className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors">🗑️ Delete</button>
                        </div>
                      )}
                    </div>

                    <a href={link.url} target="_blank" rel="noopener noreferrer" className={`h-52 relative cursor-pointer block shrink-0 rounded-t-2xl overflow-hidden ${isTwitter && !link.thumbnail_url ? 'bg-gradient-to-br from-[#1DA1F2]/20 to-gray-900' : 'bg-gray-950'}`}>
                      {link.thumbnail_url ? (
                        <img src={link.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full text-gray-500 font-medium">
                          {isTwitter ? (
                            <svg className="w-16 h-16 opacity-30 text-[#1DA1F2] mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.054 10.054 0 01-3.127 1.195 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                          ) : (
                            <span className="opacity-70">{link.metadata_status === 'pending' ? 'Fetching Info...' : 'No Thumbnail'}</span>
                          )}
                        </div>
                      )}
                      
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-[2px]">
                        {isYouTube ? (
                          <div className="w-16 h-16 bg-red-600/90 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(255,0,0,0.6)] pl-1.5 transition-transform group-hover:scale-110">
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] pl-1.5 transition-transform group-hover:scale-110">
                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        )}
                      </div>
                    </a>
                    
                    <div className="p-6 flex-grow flex flex-col">
                      <h3 className={`text-lg font-bold mb-2 line-clamp-2 leading-snug transition-colors ${isYouTube ? 'group-hover:text-red-400' : isTwitter ? 'group-hover:text-blue-400' : 'group-hover:text-gray-300'} text-white`}>
                        {link.title || link.url}
                      </h3>
                      
                      {link.description && (
                        <div className={`mb-4 line-clamp-4 leading-relaxed whitespace-pre-wrap text-sm ${isTwitter ? 'bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 p-3 rounded-xl text-gray-300' : 'text-gray-400'}`}>
                          {link.description}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mb-5 mt-auto">
                        <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md border ${isYouTube ? 'bg-red-500/10 text-red-400 border-red-500/20' : isTwitter ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                          {platform}
                        </span>
                        {link.categories?.name && (
                           <span className="inline-block px-2.5 py-1 bg-purple-500/10 text-purple-400 text-xs font-semibold rounded-md border border-purple-500/20">
                             {link.categories.icon || '📁'} {link.categories.name}
                           </span>
                        )}
                      </div>
                    
                    <div className="space-y-3 mt-auto pt-5 border-t border-gray-700/50">
                      <h4 className="text-xs text-gray-500 font-bold uppercase tracking-wider">Timestamps & Notes</h4>
                      {link.timestamps?.map((ts: any) => (
                        <a 
                          key={ts.id} 
                          href={getTimestampUrl(link.url, ts.time_seconds)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-gray-900/60 p-3 rounded-xl flex gap-3 items-start hover:bg-gray-700/80 transition-all border border-transparent hover:border-gray-600 group/ts"
                        >
                          <span className="text-blue-400 font-mono text-sm shrink-0 bg-blue-400/10 px-2.5 py-1 rounded-md font-medium group-hover/ts:bg-blue-500/20 transition-colors">
                            {ts.time_seconds ? new Date(ts.time_seconds * 1000).toISOString().substring(11, 19) : '00:00:00'}
                          </span>
                          <span className="text-gray-300 text-sm line-clamp-3 group-hover/ts:text-white transition-colors pt-0.5">{ts.description}</span>
                        </a>
                      ))}
                      {!link.timestamps?.length && (
                        <p className="text-gray-500 text-sm italic bg-gray-900/30 p-3 rounded-xl">No timestamps recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
              {links.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center text-gray-400 py-32 bg-gray-800/20 rounded-3xl border-2 border-gray-800 border-dashed">
                  <div className="text-6xl mb-6 opacity-50">📭</div>
                  <p className="text-xl font-medium mb-2">アーカイブが見つかりません</p>
                  <p className="text-sm text-gray-500">
                    {(!supabaseUrl || !supabaseKey) 
                      ? 'Supabaseの環境変数(.env.local)を設定してください。'
                      : 'Discordで /archive コマンドを使って追加してください。'
                    }
                  </p>
                </div>
              )}
            </div>

            <div className="mt-16 flex justify-center gap-4">
              {page > 1 && (
                  <button onClick={() => setPage(page - 1)} className="px-6 py-2.5 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-all text-sm font-bold text-gray-300 hover:text-white shadow-lg shadow-gray-900/50">
                    ← Previous
                  </button>
              )}
              {links.length === limit && (
                  <button onClick={() => setPage(page + 1)} className="px-6 py-2.5 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-all text-sm font-bold text-gray-300 hover:text-white shadow-lg shadow-gray-900/50">
                    Next →
                  </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* カテゴリ編集モーダル */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingCategory(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">フォルダの編集</h3>
            <form onSubmit={handleUpdateCategory} className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex-shrink-0">
                  <label className="block text-xs text-gray-500 mb-1">Icon</label>
                  <input 
                    type="text" 
                    value={editCategoryIcon}
                    onChange={e => setEditCategoryIcon(e.target.value)}
                    maxLength={2}
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-grow">
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input 
                    type="text" 
                    value={editCategoryName}
                    onChange={e => setEditCategoryName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setEditingCategory(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
