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
                .setDescription('保存先のフォルダ（Webで作ったものが選べます）')
                .setAutocomplete(true)
                .setRequired(true))
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
        const categoryId = interaction.options.getString('folder', true);
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

        // リンク登録 (Upsert)
        let { data: link, error: linkError } = await supabase
            .from('links')
            .upsert({
                community_id: community!.id,
                url: url,
                added_by_user_id: interaction.user.id,
                category_id: categoryId,
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
            const { data: catData } = await supabase.from('categories').select('name').eq('id', categoryId).single();
            const catName = catData ? catData.name : 'Unknown';
            await interaction.editReply(`✅ **${catName}** フォルダにアーカイブを保存しました！\nURL: ${url}`);
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

client.login(process.env.DISCORD_TOKEN);
