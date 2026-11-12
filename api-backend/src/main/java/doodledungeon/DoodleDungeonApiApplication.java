package doodledungeon;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootApplication
public class DoodleDungeonApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(DoodleDungeonApiApplication.class, args);
    }

    @Bean
    CommandLineRunner verifyDatabaseConnection(JdbcTemplate jdbcTemplate) {
        return args -> {
            String databaseName = jdbcTemplate.queryForObject(
                    "SELECT current_database()",
                    String.class
            );
            System.out.println("Connected to database: " + databaseName);
        };
    }
}