package doodledungeon.controller;

import doodledungeon.dto.UpdateUserProfileRequest;
import doodledungeon.dto.UserProfile;
import doodledungeon.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserProfile getMyProfile(Principal principal) {
        return userService.getProfile(getCurrentUserId(principal));
    }

    @PatchMapping("/me")
    public UserProfile updateMyProfile(
            Principal principal,
            @RequestBody UpdateUserProfileRequest request
    ) {
        return userService.updateDisplayName(
                getCurrentUserId(principal),
                request
        );
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMyAccount(Principal principal) {
        userService.deleteAccount(getCurrentUserId(principal));
        return ResponseEntity.noContent().build();
    }

    private UUID getCurrentUserId(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Sign-in is required"
            );
        }

        try {
            return UUID.fromString(principal.getName());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid user identity"
            );
        }
    }
}