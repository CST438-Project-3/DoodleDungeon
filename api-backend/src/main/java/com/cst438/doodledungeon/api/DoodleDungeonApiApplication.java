package com.cst438.doodledungeon.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DoodleDungeonApiApplication {

    // Spring starts the server and scans this package and its subpackages for controllers and services.
    public static void main(String[] args) {
        SpringApplication.run(DoodleDungeonApiApplication.class, args);
    }
}
