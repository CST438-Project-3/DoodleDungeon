package com.cst438.doodledungeon.api.guardian;

import com.cst438.doodledungeon.api.guardian.GuardianController.*;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class GuardianService {
    private static final Set<String> CLASSES = Set.of("Warrior", "Brawler", "Ranger", "Mage");
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public GuardianService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public List<Guardian> list(UUID owner) {
        requireUser(owner);
        return jdbc.query("SELECT * FROM guardians WHERE owner_user_id = ? ORDER BY created_at DESC, id", this::map, owner);
    }

    public Guardian get(UUID owner, UUID id) {
        requireUser(owner);
        return jdbc.query("SELECT * FROM guardians WHERE owner_user_id = ? AND id = ?", this::map, owner, id)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found"));
    }

    @Transactional
    public Guardian create(UUID owner, CreateGuardian request) {
        requireUser(owner);
        validate(request);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO guardians (id, owner_user_id, name, class_name, art_url, art_strokes)
                VALUES (?, ?, ?, ?, ?, ?::jsonb)
                """, id, owner, request.name().trim(), request.guardianClass(), svgDataUrl(request.strokes()),
                json.writeValueAsString(request.strokes()));
        return get(owner, id);
    }

    private void requireUser(UUID owner) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM app_users WHERE id = ?)", Boolean.class, owner))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
        }
    }

    private void validate(CreateGuardian request) {
        if (request.name() == null || request.name().isBlank() || request.name().trim().length() > 150) {
            badRequest("Enter a guardian name of 1 to 150 characters.");
        }
        if (request.guardianClass() == null || !CLASSES.contains(request.guardianClass())) badRequest("Choose a valid class.");
        if (request.strokes() == null || request.strokes().isEmpty() || request.strokes().size() > 500) {
            badRequest("Draw some guardian art (up to 500 strokes).");
        }
        int points = 0;
        for (Stroke stroke : request.strokes()) {
            if (stroke == null || stroke.color() == null || !stroke.color().matches("#[0-9a-fA-F]{6}")
                    || stroke.points() == null || stroke.points().isEmpty()) badRequest("Invalid drawing stroke.");
            points += stroke.points().size();
            if (points > 20000) badRequest("The drawing is too large. Use fewer strokes.");
            for (Point point : stroke.points()) {
                if (point == null || !coordinate(point.x()) || !coordinate(point.y())) badRequest("Drawing points must be between 0 and 300.");
            }
        }
    }

    private boolean coordinate(Double value) {
        return value != null && Double.isFinite(value) && value >= 0 && value <= 300;
    }

    private void badRequest(String message) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private Guardian map(ResultSet rs, int row) throws SQLException {
        return new Guardian(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("class_name"),
                json.readValue(rs.getString("art_strokes"), new TypeReference<List<Stroke>>() {}),
                rs.getString("art_url"), rs.getTimestamp("created_at").toInstant());
    }

    private String svgDataUrl(List<Stroke> strokes) {
        StringBuilder svg = new StringBuilder("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 300\"><rect width=\"300\" height=\"300\" fill=\"white\"/>");
        for (Stroke stroke : strokes) {
            Point first = stroke.points().getFirst();
            if (stroke.points().size() == 1) {
                svg.append("<circle cx=\"").append(first.x()).append("\" cy=\"").append(first.y())
                        .append("\" r=\"3\" fill=\"").append(stroke.color()).append("\"/>");
            } else {
                svg.append("<path fill=\"none\" stroke=\"").append(stroke.color())
                        .append("\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M ")
                        .append(first.x()).append(' ').append(first.y());
                for (Point point : stroke.points().subList(1, stroke.points().size())) {
                    svg.append(" L ").append(point.x()).append(' ').append(point.y());
                }
                svg.append("\"/>");
            }
        }
        svg.append("</svg>");
        return "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(svg.toString().getBytes(StandardCharsets.UTF_8));
    }
}
