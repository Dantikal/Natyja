-- Schema only. No users, passwords, reports or uploaded files.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `ideas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `author_id` int NOT NULL,
  `soldier_id` int DEFAULT NULL,
  `unit_id` int DEFAULT NULL,
  `title` varchar(160) NOT NULL,
  `description` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `ai_status` varchar(20) NOT NULL DEFAULT 'queued',
  `ai_score` int DEFAULT NULL,
  `ai_priority` varchar(20) DEFAULT NULL,
  `ai_analysis` json DEFAULT NULL,
  `ai_error` varchar(250) DEFAULT NULL,
  `ai_started_at` datetime DEFAULT NULL,
  `ai_finished_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `review_comment` text,
  PRIMARY KEY (`id`),
  KEY `idx_ideas_queue` (`ai_status`,`id`),
  KEY `idx_ideas_author` (`author_id`,`created_at`),
  KEY `idx_ideas_unit` (`unit_id`,`status`),
  KEY `idx_ideas_rating` (`soldier_id`,`status`,`reviewed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `military_units` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ranks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('младший','средний','старший','высший','гражданский') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'младший',
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `report_ai_assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `version_id` int NOT NULL,
  `task_title` varchar(255) DEFAULT NULL,
  `task_description` text,
  `task_attachment` varchar(255) DEFAULT NULL,
  `state` varchar(20) NOT NULL DEFAULT 'queued',
  `decision` varchar(20) DEFAULT NULL,
  `points` int DEFAULT NULL,
  `analysis` json DEFAULT NULL,
  `error_message` varchar(300) DEFAULT NULL,
  `appeal_text` text,
  `appeal_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_report_ai_version` (`version_id`),
  KEY `idx_report_ai_queue` (`state`,`id`),
  KEY `idx_report_ai_task` (`task_id`,`version_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `report_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `submitted_by` int DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `report_type` varchar(20) DEFAULT NULL,
  `report_html` mediumtext,
  `report_table_json` json DEFAULT NULL,
  `report_note` text,
  `report_file` varchar(255) DEFAULT NULL,
  `report_file_type` varchar(255) DEFAULT NULL,
  `outcome` varchar(20) NOT NULL DEFAULT 'pending',
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `review_comment` text,
  PRIMARY KEY (`id`),
  KEY `idx_report_task` (`task_id`,`id`),
  KEY `idx_report_date` (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `soldiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `rank_id` int DEFAULT NULL,
  `position_id` int DEFAULT NULL,
  `unit_id` int DEFAULT NULL,
  `years_of_service` int DEFAULT '0',
  `reprimands` int DEFAULT '0',
  `characteristic` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `photo_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `works_percent` int DEFAULT '0',
  `shifts_percent` int DEFAULT '0',
  `useful_percent` int GENERATED ALWAYS AS ((`works_percent` - `shifts_percent`)) STORED,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `photo_file` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rank_id` (`rank_id`),
  KEY `position_id` (`position_id`),
  KEY `unit_id` (`unit_id`),
  CONSTRAINT `soldiers_ibfk_1` FOREIGN KEY (`rank_id`) REFERENCES `ranks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `soldiers_ibfk_2` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `soldiers_military_unit_fk` FOREIGN KEY (`unit_id`) REFERENCES `military_units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `task_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action` varchar(50) NOT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_task_history` (`task_id`),
  CONSTRAINT `task_history_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_history_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `task_notification_reads` (
  `user_id` int NOT NULL,
  `task_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `task_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `from_soldier_id` int NOT NULL,
  `to_soldier_id` int NOT NULL,
  `transferred_by` int NOT NULL,
  `reason` text NOT NULL,
  `bonus_points` int NOT NULL DEFAULT '10',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `transfer_type` varchar(20) NOT NULL DEFAULT 'handoff',
  PRIMARY KEY (`id`),
  KEY `idx_task_transfers_task` (`task_id`),
  KEY `idx_task_transfers_to_year` (`to_soldier_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `soldier_id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `priority` enum('обычная','важная','срочная') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'обычная',
  `classification` enum('открыто','ДСП','секретно') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'открыто',
  `week_start` date NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('новая','в_работе','на_проверке','выполнена','провалена') COLLATE utf8mb4_unicode_ci DEFAULT 'новая',
  `report_file` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `report_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `original_soldier_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `quality_score` decimal(5,2) DEFAULT NULL,
  `quality_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `failure_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `assignment_stage` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'executor',
  `review_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_required',
  `review_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `task_direction` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `required_position_id` int DEFAULT NULL,
  `report_data` json DEFAULT NULL,
  `report_note` text COLLATE utf8mb4_unicode_ci,
  `admin_comment` text COLLATE utf8mb4_unicode_ci,
  `report_type` enum('text','table') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `report_html` mediumtext COLLATE utf8mb4_unicode_ci,
  `report_table_json` json DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `report_file_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_task_id` int DEFAULT NULL,
  `task_file` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `task_file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `task_file_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `awarded_points` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_soldier` (`soldier_id`),
  KEY `idx_status` (`status`),
  KEY `idx_week` (`week_start`),
  KEY `parent_task_id` (`parent_task_id`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`soldier_id`) REFERENCES `soldiers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `units` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_user_id` int DEFAULT NULL,
  `target_user_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_activity_target` (`target_user_id`,`created_at`),
  KEY `idx_user_activity_actor` (`actor_user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('pending','user','commander','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approved` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `soldier_id` int DEFAULT NULL,
  `rank_id` int DEFAULT NULL,
  `position_id` int DEFAULT NULL,
  `unit_id` int DEFAULT NULL,
  `photo_file` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requested_role` enum('user','commander') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `token_version` int NOT NULL DEFAULT '0',
  `last_login_at` datetime DEFAULT NULL,
  `custom_rank` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `custom_position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `custom_unit` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `soldier_id` (`soldier_id`),
  KEY `rank_id` (`rank_id`),
  KEY `position_id` (`position_id`),
  KEY `unit_id` (`unit_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`soldier_id`) REFERENCES `soldiers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`rank_id`) REFERENCES `ranks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_3` FOREIGN KEY (`position_id`) REFERENCES `positions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_4` FOREIGN KEY (`unit_id`) REFERENCES `military_units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
