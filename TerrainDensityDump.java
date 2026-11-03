import java.lang.reflect.*;
import java.util.Locale;
import sun.misc.Unsafe;

public class TerrainDensityDump {
    public static void main(String[] args) throws Exception {
        long seed = Long.parseLong(args[0]);
        int biomeId = Integer.parseInt(args[1]);

        Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
        unsafeField.setAccessible(true);
        Unsafe unsafe = (Unsafe) unsafeField.get(null);

        ry world = (ry) unsafe.allocateInstance(ry.class);

        String[] names = {"a", "b", "c", "d", "e"};
        int[] values = {7, 11, 128, 127, 63};

        for (int i = 0; i < names.length; i++) {
            Field field = ry.class.getDeclaredField(names[i]);
            field.setAccessible(true);
            field.setInt(world, values[i]);
        }

        Field biomeRegistry = sr.class.getDeclaredField("a");
        biomeRegistry.setAccessible(true);
        sr[] registered = (sr[]) biomeRegistry.get(null);

        sr[] biomes = new sr[100];
        for (int i = 0; i < biomes.length; i++) {
            biomes[i] = registered[biomeId];
        }

        xj generator = new xj(world, seed, false);

        Field biomeField = xj.class.getDeclaredField("y");
        biomeField.setAccessible(true);
        biomeField.set(generator, biomes);

        Method method = xj.class.getDeclaredMethod(
            "a",
            double[].class,
            int.class, int.class, int.class,
            int.class, int.class, int.class
        );
        method.setAccessible(true);

        double[] result = (double[]) method.invoke(
            generator,
            new Object[] {null, 0, 0, 0, 5, 17, 5}
        );

        for (double value : result) {
            System.out.printf(Locale.ROOT, "%.17g%n", value);
        }
    }
}
