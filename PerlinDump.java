import java.lang.reflect.Field;
import java.util.Locale;
import java.util.Random;

public class PerlinDump {
    public static void main(String[] args) throws Exception {
        agk noise = new agk(new Random(12345L));

        System.out.printf(Locale.ROOT, "O %.17g %.17g %.17g%n",
            noise.a, noise.b, noise.c);

        Field field = agk.class.getDeclaredField("d");
        field.setAccessible(true);
        int[] permutation = (int[]) field.get(noise);

        System.out.print("P");
        for (int value : permutation) System.out.print(" " + value);
        System.out.println();
    }
}
