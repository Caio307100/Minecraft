import java.util.Locale;
import java.util.Random;

public class GradDump {
    public static void main(String[] args) {
        agk noise = new agk(new Random(12345L));
        for (int i = 0; i < 16; i++) {
            System.out.printf(Locale.ROOT, "%.17g%n",
                noise.a(i, 0.23, 0.47, 0.81));
        }
    }
}
