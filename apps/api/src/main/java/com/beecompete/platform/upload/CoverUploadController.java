package com.beecompete.platform.upload;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/**
 * R1-19 cover-image upload: hands the admin browser a short-TTL pre-signed PUT URL so it uploads a
 * cover straight to the public-assets bucket — never proxied through the API (architecture Files
 * rule). Admin-gated (URL under {@code /api/v1/admin/**}, so the {@code AdminTokenFilter} covers it).
 * Returns 503 when no bucket is configured; validates content-type + size before signing so a bad
 * request never mints a URL. The stored key lives under {@code covers/} — the only prefix the
 * bucket policy exposes for public read.
 */
@RestController
@RequestMapping("/api/v1/admin/uploads")
public class CoverUploadController {

	private static final long MAX_BYTES = 5L * 1024 * 1024; // 5 MB
	private static final Duration TTL = Duration.ofMinutes(5);
	private static final Map<String, String> EXT_BY_TYPE =
			Map.of("image/png", "png", "image/jpeg", "jpg", "image/webp", "webp");

	private final ObjectProvider<S3Presigner> presigner;
	private final String bucket;
	private final String publicBaseUrl;

	public CoverUploadController(ObjectProvider<S3Presigner> presigner,
			@Value("${aws.s3.bucket:}") String bucket,
			@Value("${aws.s3.public-base-url:}") String publicBaseUrl) {
		this.presigner = presigner;
		this.bucket = bucket;
		this.publicBaseUrl = publicBaseUrl;
	}

	@PostMapping("/cover")
	public CoverUploadResponse cover(@Valid @RequestBody CoverUploadRequest request) {
		S3Presigner p = presigner.getIfAvailable();
		if (p == null || bucket.isBlank() || publicBaseUrl.isBlank()) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"cover upload isn't configured — set S3_BUCKET, AWS_REGION, and S3_PUBLIC_BASE_URL");
		}
		String ext = EXT_BY_TYPE.get(request.contentType());
		if (ext == null) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"cover must be a PNG, JPEG, or WebP image");
		}
		if (request.sizeBytes() > MAX_BYTES) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "cover must be 5 MB or smaller");
		}

		// The content-type is a SIGNED header — the browser's PUT must send exactly this, which the
		// web upload helper does. The object needs no ACL: the bucket policy makes covers/ public.
		String key = "covers/" + UUID.randomUUID() + "." + ext;
		PutObjectRequest put = PutObjectRequest.builder().bucket(bucket).key(key)
				.contentType(request.contentType()).build();
		PresignedPutObjectRequest presigned = p.presignPutObject(PutObjectPresignRequest.builder()
				.signatureDuration(TTL).putObjectRequest(put).build());
		String publicUrl = publicBaseUrl.replaceAll("/+$", "") + "/" + key;
		return new CoverUploadResponse(presigned.url().toString(), publicUrl);
	}

	public record CoverUploadRequest(@NotBlank String contentType, @Positive long sizeBytes) {}

	public record CoverUploadResponse(String uploadUrl, String publicUrl) {}
}
