import java.util.Random;

public class RandomSequenceDump {
    public static void main(String[] args) {
        Random r = new Random(Long.parseLong(args[0]));

        for (int i = 0; i < 3; i++)
            System.out.printf("D %.17g%n", r.nextDouble());

        for (int i = 0; i < 256; i++)
            System.out.println("I " + r.nextInt(256 - i));
    }
}
