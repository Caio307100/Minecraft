import java.util.Locale;
import java.util.Random;

public class PerlinOneDump {
    public static void main(String[] args) {
        agk noise = new agk(new Random(12345L));
        double[] out = new double[18];

        noise.a(out, -3, 5, 7, 3, 2, 3,
            0.0625, 0.125, 0.0625, 1.0);

        for (double value : out)
            System.out.printf(Locale.US, "%.17g%n", value);
    }
}
