package com.beecompete.catalog.repository;

import com.beecompete.catalog.domain.CorrectionProposal;
import com.beecompete.catalog.domain.CorrectionStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CorrectionProposalRepository extends JpaRepository<CorrectionProposal, UUID> {

	List<CorrectionProposal> findByStatus(CorrectionStatus status);
}
