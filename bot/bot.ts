import { Client, GatewayIntentBits, Events, SlashCommandBuilder, Interaction } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

console.log("Bot process started. Node version:", process.version);
console.log("ENV VARS: SUPABASE_URL=", !!process.env.SUPABASE_URL, "DISCORD_TOKEN=", !!process.env.DISCORD_TOKEN);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const ALLOWED_DOMAINS = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'twitch.tv'];

client.on(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    
    // スラッシュコマンドを動的に登録
    const archiveCommand = new SlashCommandBuilder()
        .setName('archive')
        .setDescription('リンクとタイムスタンプをフォルダに保存します')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('保存したいYouTubeなどのURL')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('folder')
                .setDescription('保存先のフォルダ（省略可。Webで作ったものが選べます）')
                .setAutocomplete(true)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('メモやタイムスタンプ（例: 1:23:45 このシーン）')
                .setRequired(false));

    await client.application?.commands.set([archiveCommand]);
    console.log('Slash commands registered.');
});

// コマンドの自動補完（Autocomplete）処理
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isAutocomplete()) return;

    if (interaction.commandName === 'archive') {
        const focusedValue = interaction.options.getFocused();
        
        // Supabaseからカテゴリを取得してサジェスト
        const { data: categories } = await supabase
            .from('categories')
            .select('id, name')
            .ilike('name', `%${focusedValue}%`)
            .limit(25);

        const choices = categories?.map(cat => ({ name: cat.name, value: cat.id })) || [];
        await interaction.respond(choices);
    }
});

// コマンド実行処理
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'archive') {
        const url = interaction.options.getString('url', true);
        const categoryId = interaction.options.getString('folder');
        const note = interaction.options.getString('note') || '';

        // ドメイン検証
        try {
            const urlObj = new URL(url);
            const isAllowed = ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain));
            if (!isAllowed) {
                await interaction.reply({ content: '許可されていないURLです。', ephemeral: true });
                return;
            }
        } catch {
            await interaction.reply({ content: '無効なURLです。', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        // コミュニティ取得
        let { data: community } = await supabase.from('communities').select('id').eq('discord_server_id', interaction.guildId).single();
        if (!community) {
            const { data: newCommunity } = await supabase.from('communities').insert({ discord_server_id: interaction.guildId, name: interaction.guild?.name || 'Unknown' }).select().single();
            community = newCommunity;
        }

        // categoryIdが正しいUUID形式かチェック（ユーザーが自由入力した場合の対策）
        let validCategoryId = null;
        if (categoryId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
            validCategoryId = categoryId;
        }

        // リンク登録 (Upsert)
        let { data: link, error: linkError } = await supabase
            .from('links')
            .upsert({
                community_id: community!.id,
                url: url,
                added_by_user_id: interaction.user.id,
                category_id: validCategoryId,
                metadata_status: 'pending'
            }, { onConflict: 'community_id, url' })
            .select().single();

        if (linkError || !link) {
            await interaction.editReply('❌ リンクの保存に失敗しました。');
            return;
        }

        // タイムスタンプ登録
        const timeSeconds = parseTimeToSeconds(note); 
        const { error: tsError } = await supabase.from('timestamps').upsert({
            link_id: link.id,
            time_seconds: timeSeconds,
            description: note.trim() || 'No description',
            discord_message_id: interaction.id // コマンドのIDを仮のメッセージIDとして扱う
        }, { onConflict: 'discord_message_id' });

        if (tsError) {
            await interaction.editReply('❌ タイムスタンプの保存に失敗しました。');
        } else {
            // カテゴリ名を取得して返信に含める
            let catName = '未分類';
            if (validCategoryId) {
                const { data: catData } = await supabase.from('categories').select('name').eq('id', validCategoryId).single();
                if (catData) catName = catData.name;
            }
            await interaction.editReply(`✅ **${catName}** フォルダにアーカイブを保存しました！\nURL: ${url}`);
            
            // 非同期でメタデータ取得を開始
            fetchAndSaveMetadata(link.id, url).catch(console.error);
        }
    }
});

function parseTimeToSeconds(text: string): number | null {
    const match = text.match(/(?:(\d+):)?(\d+):(\d+)/);
    if (match) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
}

async function fetchAndSaveMetadata(linkId: string, url: string) {
    try {
        let title = null;
        let description = null;
        let imageUrl = null;

        const urlObj = new URL(url);
        
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const res = await fetch(oembedUrl);
            if (res.ok) {
                const data = await res.json();
                title = data.title;
                description = data.author_name;
                imageUrl = data.thumbnail_url;
            }
        } else if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
            const pathParts = urlObj.pathname.split('/');
            const statusIndex = pathParts.indexOf('status');
            if (statusIndex !== -1 && pathParts.length > statusIndex + 1) {
                const tweetId = pathParts[statusIndex + 1];
                const fxtwitterUrl = `https://api.fxtwitter.com/Twitter/status/${tweetId}`;
                const res = await fetch(fxtwitterUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data.code === 200 && data.tweet) {
                        title = `${data.tweet.author.name} (@${data.tweet.author.screen_name})`;
                        description = data.tweet.text;
                        if (data.tweet.media && data.tweet.media.photos && data.tweet.media.photos.length > 0) {
                            imageUrl = data.tweet.media.photos[0].url;
                        }
                    }
                }
            }
        }

        if (title || description) {
            await supabase.from('links').update({
                title: title,
                description: description,
                image_url: imageUrl,
                metadata_status: 'success'
            }).eq('id', linkId);
            console.log(`Metadata updated for link ${linkId}: ${title}`);
        } else {
            await supabase.from('links').update({
                metadata_status: 'failed'
            }).eq('id', linkId);
            console.log(`Failed to fetch metadata for ${url}`);
        }
    } catch (err) {
        console.error(`Error fetching metadata for ${url}:`, err);
        await supabase.from('links').update({
            metadata_status: 'failed'
        }).eq('id', linkId);
    }
}

client.login(process.env.DISCORD_TOKEN);
