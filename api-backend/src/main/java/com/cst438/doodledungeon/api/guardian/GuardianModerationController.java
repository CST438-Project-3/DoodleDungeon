package com.cst438.doodledungeon.api.guardian;

import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/guardians")
public class GuardianModerationController {
    private final GuardianModerationService service;

    public GuardianModerationController(GuardianModerationService service) {
        this.service = service;
    }

    @GetMapping
    public List<GuardianModerationService.GuardianForModeration> listGuardians(Principal principal) {
        UUID requestingUserId = UUID.fromString(principal.getName());
        return service.listGuardians(requestingUserId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGuardian(Principal principal, @PathVariable UUID id) {
        UUID requestingUserId = UUID.fromString(principal.getName());
        service.deleteGuardian(requestingUserId, id);
        return ResponseEntity.noContent().build();
    }
}