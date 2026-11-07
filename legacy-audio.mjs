// yy.java: cada bloco aponta para um wu (som, volume e pitch).
// Os valores abaixo reproduzem os sons registrados no Minecraft 1.0.
const SOUND_TYPES = {
    1: 'stone', 2: 'grass', 3: 'grass', 4: 'stone', 5: 'wood',
    6: 'grass', 7: 'stone', 12: 'sand', 13: 'gravel',
    14: 'stone', 15: 'stone', 16: 'stone', 17: 'wood',
    18: 'grass', 19: 'stone', 20: 'stone', 21: 'stone',
    22: 'stone', 23: 'stone', 24: 'stone', 25: 'wood',
    26: 'cloth', 27: 'stone-high', 28: 'stone-high',
    29: 'stone-high', 30: 'stone', 31: 'grass', 32: 'grass',
    33: 'stone', 34: 'stone', 35: 'cloth', 37: 'grass',
    38: 'grass', 39: 'grass', 40: 'grass', 41: 'stone-high',
    42: 'stone-high', 43: 'stone', 44: 'stone', 45: 'stone',
    46: 'grass', 47: 'wood', 48: 'stone', 49: 'stone',
    50: 'wood', 51: 'wood', 52: 'stone-high', 53: 'wood',
    54: 'wood', 55: 'stone', 56: 'stone', 57: 'stone-high',
    58: 'wood', 59: 'grass', 60: 'gravel', 61: 'stone',
    62: 'stone', 63: 'wood', 64: 'wood', 65: 'wood',
    66: 'stone-high', 67: 'stone', 68: 'wood', 69: 'wood',
    70: 'stone', 71: 'stone-high', 72: 'wood', 73: 'stone',
    74: 'stone', 75: 'wood', 76: 'wood', 77: 'stone',
    78: 'cloth', 79: 'stone', 80: 'cloth', 81: 'cloth',
    82: 'gravel', 83: 'grass', 84: 'wood', 85: 'wood',
    86: 'wood', 87: 'stone', 88: 'sand', 89: 'stone',
    90: 'stone', 91: 'wood', 92: 'cloth', 93: 'wood',
    94: 'wood', 95: 'wood', 96: 'wood', 97: 'wood',
    98: 'wood', 99: 'wood', 100: 'wood', 101: 'stone-high',
    102: 'stone', 103: 'stone', 104: 'wood', 105: 'wood',
    106: 'grass', 107: 'wood', 108: 'stone', 109: 'stone',
    110: 'grass', 111: 'grass', 112: 'stone', 113: 'stone',
    114: 'stone', 115: 'grass', 116: 'stone', 117: 'stone',
    118: 'stone', 119: 'stone', 120: 'stone', 121: 'stone',
    122: 'stone'
};

const SOUND_PROPERTIES = {
    stone: { name: 'stone', volume: 1, pitch: 1 },
    'stone-high': { name: 'stone', volume: 1, pitch: 1.5 },
    wood: { name: 'wood', volume: 1, pitch: 1 },
    gravel: { name: 'gravel', volume: 1, pitch: 1 },
    grass: { name: 'grass', volume: 1, pitch: 1 },
    cloth: { name: 'cloth', volume: 1, pitch: 1 },
    snow: { name: 'snow', volume: 1, pitch: 1 },
    sand: { name: 'sand', volume: 1, pitch: 1 }
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
        const type = SOUND_TYPES[blockId] || 'stone';
        return SOUND_PROPERTIES[type] || SOUND_PROPERTIES.stone;
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

        placeBlock(blockId) {
            // ItemBlock do Minecraft 1.0: (volume + 1) / 2 e pitch * 0.8.
            const sound = material(blockId);
            play(`step/${sound.name}${variant(sound.name)}.ogg`,
                (sound.volume + 1) / 2,
                sound.pitch * 0.8
            );
        },

        breakBlock(blockId) {
            const sound = material(blockId);
            play(`step/${sound.name}${variant(sound.name)}.ogg`,
                (sound.volume + 1) / 2,
                sound.pitch * 0.8
            );
        },

        // dm.c: mineração a cada 4 ticks: (volume + 1) / 8 e pitch * 0.5.
        mineTick(blockId) {
            const sound = material(blockId);
            play(`step/${sound.name}${variant(sound.name)}.ogg`,
                (sound.volume + 1) / 8,
                sound.pitch * 0.5
            );
        },

        // Efeito separado para quebra de ferramenta (nq.b).
        itemBreak() {
            play('random/break.ogg', 0.8, 0.8 + Math.random() * 0.4);
        },

        step(blockId) {
            const sound = material(blockId);
            play(`step/${sound.name}${variant(sound.name)}.ogg`,
                sound.volume * 0.15,
                sound.pitch,
                false
            );
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
