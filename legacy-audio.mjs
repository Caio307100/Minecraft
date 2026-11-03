const TYPES = {
    1: 'stone',
    2: 'grass',
    3: 'grass',
    7: 'stone',
    12: 'sand',
    13: 'gravel',
    24: 'stone',
    79: 'stone',
    110: 'grass'
};

const musicFiles = ['calm1.ogg', 'calm2.ogg', 'calm3.ogg'];

const files = [
    'random/click.ogg',
    'random/explode.ogg',
    'random/splash.ogg',
    'liquid/splash.ogg',
    'liquid/water.ogg',
    'random/break.ogg',
    'damage/fallsmall.ogg',
    'damage/fallbig1.ogg',
    'damage/fallbig2.ogg'
];

for (const type of ['stone', 'grass', 'sand', 'gravel', 'cloth', 'snow', 'wood']) {
    for (let i = 1; i <= 4; i++) {
        files.push(`step/${type}${i}.ogg`);
    }
}

export function createLegacyAudio() {
    let context = null;
    let loading = null;
    let underwater = false;
    let soundVolume = 1;
    let musicVolume = 1;
    let musicStarted = false;
    let musicTicksRemaining = Math.floor(Math.random() * 12000);
    let musicSource = null;
    let musicGainNode = null;

    const buffers = new Map();
    const musicBuffers = new Map();
    const pending = [];
    const lastVariant = {};

    function getContext() {
        if (!context) {
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) throw new Error('Web Audio não disponível.');
            context = new Audio();
        }
        return context;
    }

    function playMusic() {
        if (musicStarted || musicVolume <= 0 || musicBuffers.size === 0) return;

        const tracks = [...musicBuffers.values()];
        const track = tracks[Math.floor(Math.random() * tracks.length)];
        const source = getContext().createBufferSource();
        const gain = getContext().createGain();

        source.buffer = track;
        gain.gain.value = musicVolume;
        musicGainNode = gain;
        source.connect(gain);
        gain.connect(getContext().destination);
        musicStarted = true;
        musicSource = source;
        source.onended = () => {
            musicStarted = false;
            musicSource = null;
        };
        source.start();
    }

    async function preload() {
        if (loading) return loading;

        const ctx = getContext();

        loading = Promise.all([
            ...files.map(async path => {
                try {
                    const response = await fetch(
                        `./public/assets/mc10/sounds/${path}`
                    );

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.arrayBuffer();
                    buffers.set(path, await ctx.decodeAudioData(data));
                } catch (error) {
                    console.warn(`Falha ao carregar ${path}:`, error);
                }
            }),
            ...musicFiles.map(async file => {
                try {
                    const response = await fetch(
                        `./public/assets/mc10/music/${file}`
                    );

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.arrayBuffer();
                    musicBuffers.set(file, await ctx.decodeAudioData(data));
                } catch (error) {
                    console.warn(`Falha ao carregar música ${file}:`, error);
                }
            })
        ]).then(() => {
            for (const sound of pending.splice(0)) {
                playNow(...sound);
            }

            console.log(`Áudios Minecraft carregados: ${buffers.size}`);
            console.log(`Músicas Minecraft carregadas: ${musicBuffers.size}`);
        });

        return loading;
    }

    function unlock() {
        const ctx = getContext();

        if (ctx.state === 'suspended') {
            ctx.resume().catch(console.error);
        }

        void preload();
    }

    function playNow(path, volume, pitch) {
        const buffer = buffers.get(path);
        if (!buffer) return;

        const source = context.createBufferSource();
        const gain = context.createGain();

        source.buffer = buffer;
        source.playbackRate.value = pitch;
        gain.gain.value = volume * soundVolume * (underwater ? 0.45 : 1);

        source.connect(gain);
        gain.connect(context.destination);
        source.start();
    }

    function play(path, volume, pitch = 1, queue = true) {
        unlock();

        if (buffers.has(path)) {
            playNow(path, volume, pitch);
            return;
        }

        if (queue && pending.length < 4) {
            pending.push([path, volume, pitch]);
        }
    }

    function variant(type) {
        let value = 1 + Math.floor(Math.random() * 4);

        if (value === lastVariant[type]) {
            value = value % 4 + 1;
        }

        lastVariant[type] = value;
        return value;
    }

    function material(blockId) {
        return TYPES[blockId] || 'stone';
    }

    return {
        unlock,

        setSoundVolume(value) {
            soundVolume = Math.max(0, Math.min(1, Number(value) || 0));
        },

        setMusicVolume(value) {
            musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
            if (musicGainNode && context) {
                musicGainNode.gain.setTargetAtTime(musicVolume, context.currentTime, 0.05);
            }
            if (musicVolume === 0 && musicSource) {
                musicSource.stop();
                musicSource = null;
                musicStarted = false;
            }
        },

        tickMusic() {
            if (!context || context.state !== 'running' || musicVolume === 0 ||
                musicBuffers.size === 0 || musicStarted) return;

            if (musicTicksRemaining > 0) {
                musicTicksRemaining--;
                return;
            }

            playMusic();
            musicTicksRemaining = 12000 + Math.floor(Math.random() * 12000);
        },

        click() {
            play('random/click.ogg', 0.35, 0.95 + Math.random() * 0.1);
        },

        breakBlock(blockId) {
            // Minecraft 1.0 usa step.<material> também no som de quebra
            // (afv, evento 2001): volume (b + 1) / 2 e pitch c * 0.8.
            const type = material(blockId);
            play(`step/${type}${variant(type)}.ogg`, 1.0, 0.8);
        },

        // dm.c: som de mineração a cada 4 ticks, volume (b + 1) / 8,
        // pitch c * 0.5. No Minecraft 1.0 b=c=1 para os sons de bloco.
        mineTick(blockId) {
            const type = material(blockId);
            play(`step/${type}${variant(type)}.ogg`, 0.25, 0.5);
        },

        // Efeito separado para quebra de ferramenta (nq.b).
        itemBreak() {
            play('random/break.ogg', 0.8, 0.8 + Math.random() * 0.4);
        },

        step(blockId) {
            const type = material(blockId);
            play(`step/${type}${variant(type)}.ogg`, 0.18, 1, false);
        },

        land(speed) {
            if (speed < -20) {
                const file = Math.random() < 0.5
                    ? 'damage/fallbig1.ogg'
                    : 'damage/fallbig2.ogg';

                play(file, 0.65);
            } else if (speed < -12) {
                play('damage/fallsmall.ogg', 0.5);
            }
        },
        splash(volume = 0.5, pitch = 1, hard = false) {
            const path = hard ? 'random/splash.ogg' : 'liquid/splash.ogg';
            play(path, volume, pitch);
        },
        waterAmbient() {
            play('liquid/water.ogg', 0.2, 0.85 + Math.random() * 0.3);
        },
        swim() {
            play('liquid/splash.ogg', 0.12, 0.85 + Math.random() * 0.3, false);
        },
        setUnderwater(value) {
            underwater = Boolean(value);
        },
    };
}
