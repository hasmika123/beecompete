package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.ImportRecord;
import com.beecompete.catalog.domain.ImportStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImportRecordRepository extends JpaRepository<ImportRecord, UUID> {

	Page<ImportRecord> findByStatusOrderByCreatedAt(ImportStatus status, Pageable pageable);
}
