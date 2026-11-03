import java.util.Locale;
import java.util.Random;

public class NoiseDump {
    public static void main(String[] args) {
        long seed = Long.parseLong(args[0]);
        int octaves = Integer.parseInt(args[1]);

        eb noise = new eb(new Random(seed), octaves);

        if (args[2].equals("2d")) {
            double[] out = noise.a(
                null, -3, 7, 4, 3, 0.0625, 0.0625, 0.0625
            );
            for (double value : out)
                System.out.printf(Locale.ROOT, "%.17g%n", value);
        } else {
            double[] out = noise.a(
                null, -3, 5, 7, 3, 2, 3,
                0.0625, 0.125, 0.0625
            );
            for (double value : out)
                System.out.printf(Locale.ROOT, "%.17g%n", value);
        }
    }
}
