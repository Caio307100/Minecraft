import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/**
 * Consulta isolada de clima do Minecraft 1.0 (oráculo, roda o código ORIGINAL do jar).
 *
 * Nomes ofuscados confirmados no bytecode:
 *   jx  = GenLayer;  jx.a(long seed) devolve 5 camadas:
 *         [0] bioma (antes do zoom Voronoi)  [1] df = VoronoiZoom (id do bioma por bloco)
 *         [2] temperatura (Q16)              [3] chuva (Q16)
 *         [4] mesma camada [0]
 *   vh  = WorldChunkManager: camada [1] -> sr.a[id]; [2],[3] -> int / 65536.0f, teto 1.0f
 *   ha  = ColorizerGrass:  ha.a(temp, chuva)
 *   sr  = BiomeGenBase
 *
 * Uso: java -cp 1.0.jar:build ClimateProbe <seed> <x> <z> [largura altura] [grasscolor.png]
 */
public class ClimateProbe {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("uso: ClimateProbe <seed> <x> <z> [w h] [grasscolor.png]");
            System.exit(1);
        }

        long seed = Long.parseLong(args[0]);
        int x0 = Integer.parseInt(args[1]);
        int z0 = Integer.parseInt(args[2]);
        int w = args.length > 3 ? Integer.parseInt(args[3]) : 1;
        int h = args.length > 4 ? Integer.parseInt(args[4]) : 1;
        String png = args.length > 5 ? args[5] : "public/assets/grasscolor.png";

        BufferedImage img = ImageIO.read(new File(png));
        if (img.getWidth() != 256 || img.getHeight() != 256) {
            throw new IllegalStateException("grasscolor.png precisa ser 256x256");
        }
        int[] pixels = new int[256 * 256];
        img.getRGB(0, 0, 256, 256, pixels, 0, 256);
        ha.a(pixels);

        jx[] layers = jx.a(seed);
        int[] biomeIds = layers[1].a(x0, z0, w, h);   // VoronoiZoom
        int[] tempQ16 = layers[2].a(x0, z0, w, h);
        int[] rainQ16 = layers[3].a(x0, z0, w, h);

        System.out.println("x\tz\tbiomaId\tbioma\ttempQ16\tchuvaQ16\ttemp\tchuva\tidxX\tidxY\tgrassRGB");

        for (int i = 0; i < w * h; i++) {
            int x = x0 + (i % w);
            int z = z0 + (i / w);

            // Mesma conversão de vh.a(float[],...) / vh.b(float[],...)
            float temp = tempQ16[i] / 65536.0f;
            if (temp > 1.0f) temp = 1.0f;
            float rain = rainQ16[i] / 65536.0f;
            if (rain > 1.0f) rain = 1.0f;

            // Mesma conta de ha.a(double,double)
            double t = temp;
            double r = (double) rain * t;
            int idxX = (int) ((1.0 - t) * 255.0);
            int idxY = (int) ((1.0 - r) * 255.0);

            int rgb = ha.a(temp, rain) & 0xFFFFFF;
            String nome = sr.a[biomeIds[i]].r;

            System.out.printf(java.util.Locale.ROOT,
                "%d\t%d\t%d\t%s\t%d\t%d\t%.6f\t%.6f\t%d\t%d\t%06X%n",
                x, z, biomeIds[i], nome, tempQ16[i], rainQ16[i], temp, rain, idxX, idxY, rgb);
        }
    }
}
