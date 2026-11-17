package com.cst438.doodledungeon.api.guardian;

import java.net.URI;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guardians")
public class GuardianController {
    private final GuardianService service;

    public GuardianController(GuardianService service) {
        this.service = service;
    }

    @GetMapping
    public List<Guardian> list(Principal principal) {
        return service.list(UUID.fromString(principal.getName()));
    }

    @PostMapping
    public ResponseEntity<Guardian> create(Principal principal, @RequestBody CreateGuardian request) {
        Guardian saved = service.create(UUID.fromString(principal.getName()), request);
        return ResponseEntity.created(URI.create("/api/guardians/" + saved.id())).body(saved);
    }

    @GetMapping("/{id}")
    public Guardian get(Principal principal, @PathVariable UUID id) {
        return service.get(UUID.fromString(principal.getName()), id);
    }

    public record Point(Double x, Double y) {}
    public record Stroke(String color, List<Point> points) {}
    public record CreateGuardian(String name, String guardianClass, List<Stroke> strokes) {}
    public record Guardian(UUID id, String name, String guardianClass, List<Stroke> strokes,
                           String artUrl, Instant createdAt) {}
}
