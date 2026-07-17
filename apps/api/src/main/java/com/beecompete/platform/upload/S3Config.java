package com.beecompete.platform.upload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * S3 presigner for cover-image uploads (R1-19). Created ONLY when a bucket is configured
 * ({@code aws.s3.bucket} non-empty) — otherwise the feature is off and {@link CoverUploadController}
 * returns 503, leaving the paste-an-image-URL fallback working. Credentials come from the AWS SDK's
 * default provider chain (env {@code AWS_ACCESS_KEY_ID} / {@code AWS_SECRET_ACCESS_KEY}); presigning
 * is a local crypto operation, so no S3 network call is made to hand the browser a PUT URL.
 */
@Configuration
public class S3Config {

	// ConditionalOnExpression (not ConditionalOnProperty): a blank value still "exists", so the
	// property condition would match an unset bucket and build a presigner with an empty region.
	@Bean(destroyMethod = "close")
	@ConditionalOnExpression("!'${aws.s3.bucket:}'.isBlank()")
	S3Presigner s3Presigner(@Value("${aws.region}") String region) {
		return S3Presigner.builder().region(Region.of(region)).build();
	}
}
