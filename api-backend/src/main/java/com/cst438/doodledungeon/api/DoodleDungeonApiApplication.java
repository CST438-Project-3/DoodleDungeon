package com.cst438.doodledungeon.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.cst438.doodledungeon.api", "doodledungeon"})
public class DoodleDungeonApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(DoodleDungeonApiApplication.class, args);
    }
}
