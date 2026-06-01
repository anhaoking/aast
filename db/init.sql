-- ============================================================
-- 爱因斯坦棋 安徽省计算机博弈大赛 数据库设计
-- 引擎: MySQL 5.7+ / InnoDB
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1. 玩家/引擎信息表
-- ----------------------------
DROP TABLE IF EXISTS `t_player`;
CREATE TABLE `t_player` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `player_name`       VARCHAR(64)     NOT NULL                 COMMENT '玩家名称/引擎名称',
  `player_type`       TINYINT         NOT NULL DEFAULT 1       COMMENT '类型: 1=人类玩家, 2=AI引擎',
  `engine_language`   VARCHAR(32)     DEFAULT NULL             COMMENT '引擎语言: java/cpp/python',
  `engine_version`    VARCHAR(16)     DEFAULT '1.0'            COMMENT '引擎版本号',
  `team_name`         VARCHAR(128)    DEFAULT NULL             COMMENT '参赛队伍',
  `school`            VARCHAR(128)    DEFAULT NULL             COMMENT '学校',
  `ip_address`        VARCHAR(45)     DEFAULT NULL             COMMENT '连接IP',
  `status`            TINYINT         NOT NULL DEFAULT 1       COMMENT '状态: 0=禁用, 1=正常',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_player_name` (`player_name`),
  KEY `idx_team` (`team_name`),
  KEY `idx_type` (`player_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家/引擎信息表';

-- ----------------------------
-- 2. 比赛/对局表
-- ----------------------------
DROP TABLE IF EXISTS `t_match`;
CREATE TABLE `t_match` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `match_name`        VARCHAR(128)    NOT NULL                 COMMENT '比赛名称',
  `match_type`        TINYINT         NOT NULL DEFAULT 1       COMMENT '类型: 1=单局, 2=多局制, 3=瑞士轮, 4=淘汰赛',
  `round_count`       INT             NOT NULL DEFAULT 1       COMMENT '总局数',
  `time_per_move`     INT             NOT NULL DEFAULT 5000    COMMENT '每步限时(毫秒)',
  `board_size`        TINYINT         NOT NULL DEFAULT 5       COMMENT '棋盘大小',
  `status`            TINYINT         NOT NULL DEFAULT 0       COMMENT '状态: 0=未开始, 1=进行中, 2=已结束, 3=已取消',
  `started_at`        DATETIME        DEFAULT NULL             COMMENT '开始时间',
  `ended_at`          DATETIME        DEFAULT NULL             COMMENT '结束时间',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_match_type` (`match_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='比赛/对局表';

-- ----------------------------
-- 3. 选手-比赛关联表
-- ----------------------------
DROP TABLE IF EXISTS `t_match_player`;
CREATE TABLE `t_match_player` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `match_id`          BIGINT UNSIGNED NOT NULL                  COMMENT '比赛ID',
  `player_id`         BIGINT UNSIGNED NOT NULL                  COMMENT '玩家ID',
  `side`              TINYINT         NOT NULL                 COMMENT '阵营: 1=红方, 2=蓝方',
  `seat_no`           TINYINT         DEFAULT NULL             COMMENT '座位号',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_match_id` (`match_id`),
  KEY `idx_player_id` (`player_id`),
  UNIQUE KEY `uk_match_side` (`match_id`, `side`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选手-比赛关联表';

-- ----------------------------
-- 4. 单局游戏记录表（核心）
-- ----------------------------
DROP TABLE IF EXISTS `t_game_record`;
CREATE TABLE `t_game_record` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `match_id`          BIGINT UNSIGNED NOT NULL                  COMMENT '所属比赛ID',
  `round_no`          INT             NOT NULL DEFAULT 1        COMMENT '轮次(多局制)',
  `red_player_id`     BIGINT UNSIGNED NOT NULL                  COMMENT '红方玩家ID',
  `blue_player_id`    BIGINT UNSIGNED NOT NULL                  COMMENT '蓝方玩家ID',
  `winner`            TINYINT         DEFAULT NULL             COMMENT '胜方: 1=红方, 2=蓝方, 0=平局',
  `win_reason`        VARCHAR(64)     DEFAULT NULL             COMMENT '胜负原因: eat_all/target_reach/no_move/timeout/illegal_move/disconnect',
  `total_steps`       INT             NOT NULL DEFAULT 0        COMMENT '总步数',
  `red_captured`      INT             NOT NULL DEFAULT 0        COMMENT '红方被吃棋子数',
  `blue_captured`     INT             NOT NULL DEFAULT 0        COMMENT '蓝方被吃棋子数',
  `red_reach_target`  INT             NOT NULL DEFAULT 0        COMMENT '红方到达目标棋子数',
  `blue_reach_target` INT             NOT NULL DEFAULT 0        COMMENT '蓝方到达目标棋子数',
  `final_board`       VARCHAR(2048)   DEFAULT NULL             COMMENT '终局棋盘状态(JSON)',
  `status`            TINYINT         NOT NULL DEFAULT 0        COMMENT '状态: 0=未开始, 1=进行中, 2=已结束',
  `started_at`        DATETIME        DEFAULT NULL             COMMENT '开始时间',
  `ended_at`          DATETIME        DEFAULT NULL             COMMENT '结束时间',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_match_id` (`match_id`),
  KEY `idx_winner` (`winner`),
  KEY `idx_red_player` (`red_player_id`),
  KEY `idx_blue_player` (`blue_player_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='单局游戏记录表';

-- ----------------------------
-- 5. 步记录表（每步详细记录）
-- ----------------------------
DROP TABLE IF EXISTS `t_move_record`;
CREATE TABLE `t_move_record` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `game_id`           BIGINT UNSIGNED NOT NULL                  COMMENT '所属对局ID',
  `step_no`           INT             NOT NULL                 COMMENT '步序号',
  `player_id`         BIGINT UNSIGNED NOT NULL                  COMMENT '走棋玩家ID',
  `side`              TINYINT         NOT NULL                 COMMENT '阵营: 1=红方, 2=蓝方',
  `dice_value`        TINYINT         NOT NULL                 COMMENT '骰子点数(1-6)',
  `piece_no`          TINYINT         NOT NULL                 COMMENT '移动棋子编号(1-12)',
  `from_pos`          VARCHAR(8)      NOT NULL                 COMMENT '起始位置 格式: x,y',
  `to_pos`            VARCHAR(8)      NOT NULL                 COMMENT '目标位置 格式: x,y',
  `direction`         VARCHAR(16)     NOT NULL                 COMMENT '移动方向: DOWN/RIGHT/RIGHTDOWN/UP/LEFT/LEFTUP',
  `captured_piece`    TINYINT         DEFAULT NULL             COMMENT '被吃棋子编号(0=无)',
  `board_snapshot`    VARCHAR(2048)   DEFAULT NULL             COMMENT '走棋后棋盘状态(JSON)',
  `think_time_ms`     INT             DEFAULT 0                COMMENT '思考耗时(毫秒)',
  `move_type`         TINYINT         DEFAULT 1                COMMENT '走法类型: 1=普通移动, 2=吃子, 3=到达目标',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_game_id` (`game_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_step_no` (`game_id`, `step_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='步记录表';

-- ----------------------------
-- 6. 通信协议日志表
-- ----------------------------
DROP TABLE IF EXISTS `t_protocol_log`;
CREATE TABLE `t_protocol_log` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `game_id`           BIGINT UNSIGNED NOT NULL                  COMMENT '所属对局ID',
  `step_no`           INT             NOT NULL                 COMMENT '步序号',
  `direction`         TINYINT         NOT NULL                 COMMENT '消息方向: 1=裁判->引擎, 2=引擎->裁判',
  `raw_message`       VARCHAR(4096)   NOT NULL                 COMMENT '原始消息内容',
  `parsed_type`       VARCHAR(32)     DEFAULT NULL             COMMENT '解析后类型: state/dice/move/result/error',
  `is_valid`          TINYINT         DEFAULT 1                COMMENT '消息是否合法: 0=非法, 1=合法',
  `error_msg`         VARCHAR(512)    DEFAULT NULL             COMMENT '错误信息',
  `timestamp_ms`      BIGINT          NOT NULL                 COMMENT '时间戳(毫秒)',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_game_id` (`game_id`),
  KEY `idx_direction` (`direction`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通信协议日志表';

-- ----------------------------
-- 7. 比赛结果统计表
-- ----------------------------
DROP TABLE IF EXISTS `t_match_result`;
CREATE TABLE `t_match_result` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `match_id`          BIGINT UNSIGNED NOT NULL                  COMMENT '比赛ID',
  `player_id`         BIGINT UNSIGNED NOT NULL                  COMMENT '玩家ID',
  `games_played`      INT             NOT NULL DEFAULT 0        COMMENT '总局数',
  `games_won`         INT             NOT NULL DEFAULT 0        COMMENT '胜局数',
  `games_lost`        INT             NOT NULL DEFAULT 0        COMMENT '负局数',
  `games_drawn`       INT             NOT NULL DEFAULT 0        COMMENT '平局数',
  `total_score`       DECIMAL(10,2)   NOT NULL DEFAULT 0.00     COMMENT '总积分',
  `avg_move_time_ms`  INT             DEFAULT 0                COMMENT '平均每步耗时(ms)',
  `max_move_time_ms`  INT             DEFAULT 0                COMMENT '最大单步耗时(ms)',
  `total_steps`       INT             NOT NULL DEFAULT 0        COMMENT '总步数',
  `pieces_captured`   INT             NOT NULL DEFAULT 0        COMMENT '总吃子数',
  `pieces_lost`       INT             NOT NULL DEFAULT 0        COMMENT '总被吃数',
  `ranking`           INT             DEFAULT NULL             COMMENT '排名',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_match_player` (`match_id`, `player_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_score` (`total_score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='比赛结果统计表';

-- ----------------------------
-- 8. 玩家历史胜率统计表
-- ----------------------------
DROP TABLE IF EXISTS `t_player_stats`;
CREATE TABLE `t_player_stats` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `player_id`             BIGINT UNSIGNED NOT NULL                  COMMENT '玩家ID',
  `total_games`           INT             NOT NULL DEFAULT 0        COMMENT '历史总局数',
  `total_wins`            INT             NOT NULL DEFAULT 0        COMMENT '历史总胜局',
  `total_losses`          INT             NOT NULL DEFAULT 0        COMMENT '历史总负局',
  `total_draws`           INT             NOT NULL DEFAULT 0        COMMENT '历史总平局',
  `win_rate`              DECIMAL(5,2)    NOT NULL DEFAULT 0.00     COMMENT '胜率(%)',
  `win_as_red`            INT             NOT NULL DEFAULT 0        COMMENT '执红胜数',
  `win_as_blue`           INT             NOT NULL DEFAULT 0        COMMENT '执蓝胜数',
  `avg_game_steps`        DECIMAL(8,2)    DEFAULT 0.00              COMMENT '平均每局步数',
  `streak_wins`           INT             NOT NULL DEFAULT 0        COMMENT '连胜场次',
  `max_streak_wins`       INT             NOT NULL DEFAULT 0        COMMENT '最大连胜',
  `elo_rating`            INT             NOT NULL DEFAULT 1500     COMMENT 'ELO等级分',
  `last_game_at`          DATETIME        DEFAULT NULL             COMMENT '最后对局时间',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_player_id` (`player_id`),
  KEY `idx_win_rate` (`win_rate` DESC),
  KEY `idx_elo` (`elo_rating` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家历史胜率统计表';

-- ----------------------------
-- 9. 异常/违规记录表
-- ----------------------------
DROP TABLE IF EXISTS `t_foul_record`;
CREATE TABLE `t_foul_record` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT  COMMENT '主键ID',
  `game_id`           BIGINT UNSIGNED NOT NULL                  COMMENT '所属对局ID',
  `player_id`         BIGINT UNSIGNED NOT NULL                  COMMENT '违规玩家ID',
  `step_no`           INT             NOT NULL                 COMMENT '违规步序号',
  `foul_type`         VARCHAR(32)     NOT NULL                 COMMENT '违规类型: timeout/illegal_move/invalid_piece/invalid_direction/disconnect',
  `detail`            VARCHAR(512)    DEFAULT NULL             COMMENT '违规详情',
  `penalty`           VARCHAR(64)     DEFAULT 'LOSE'           COMMENT '处罚: WARN=警告, LOSE=判负, DISQUALIFY=取消资格',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_game_id` (`game_id`),
  KEY `idx_player_id` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='异常/违规记录表';

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- 基础数据初始化
-- ============================================================

-- 插入示例人类玩家
INSERT INTO `t_player` (`player_name`, `player_type`, `team_name`, `school`) VALUES
('张三', 1, '星火队', '安徽大学'),
('李四', 1, '凌云队', '合肥工业大学');

-- 插入示例AI引擎
INSERT INTO `t_player` (`player_name`, `player_type`, `engine_language`, `engine_version`, `team_name`, `school`) VALUES
('AlphaEinstein',      2, 'java',   '2.0', '智弈队',   '中国科学技术大学'),
('EinsteinBot-Python', 2, 'python', '1.5', '码到成功', '安徽理工大学'),
('DeepEinstein',       2, 'cpp',    '3.1', '深蓝之弈', '安徽工程大学');


-- ============================================================
-- 常用查询语句
-- ============================================================

-- 1. 查询某玩家的历史战绩
-- SELECT * FROM t_player_stats WHERE player_id = 1;

-- 2. 查询某场比赛排名
-- SELECT mp.player_id, p.player_name, mr.total_score, mr.games_won, mr.games_lost, mr.ranking
-- FROM t_match_result mr
-- JOIN t_player p ON p.id = mr.player_id
-- WHERE mr.match_id = 1
-- ORDER BY mr.total_score DESC, mr.games_won DESC;

-- 3. 查询某局比赛的完整步骤
-- SELECT step_no, side, dice_value, piece_no, from_pos, to_pos, direction, captured_piece
-- FROM t_move_record
-- WHERE game_id = 1
-- ORDER BY step_no;

-- 4. 查询通信协议日志
-- SELECT direction, raw_message, timestamp_ms
-- FROM t_protocol_log
-- WHERE game_id = 1
-- ORDER BY timestamp_ms;

-- 5. 统计某玩家执红/执蓝胜率
-- SELECT
--   COUNT(CASE WHEN winner = 1 THEN 1 END) AS win_as_red,
--   COUNT(CASE WHEN winner = 2 THEN 1 END) AS win_as_blue,
--   COUNT(*) AS total
-- FROM t_game_record g
-- WHERE red_player_id = 1 OR blue_player_id = 1;

-- 6. 查询正在进行中的比赛
-- SELECT * FROM t_match WHERE status = 1;

-- 7. 查询正在进行中的对局
-- SELECT g.*,
--        rp.player_name AS red_name,
--        bp.player_name AS blue_name
-- FROM t_game_record g
-- JOIN t_player rp ON rp.id = g.red_player_id
-- JOIN t_player bp ON bp.id = g.blue_player_id
-- WHERE g.status = 1;

-- 8. 统计违规记录
-- SELECT p.player_name, f.foul_type, COUNT(*) AS cnt
-- FROM t_foul_record f
-- JOIN t_player p ON p.id = f.player_id
-- GROUP BY f.player_id, f.foul_type
-- ORDER BY cnt DESC;

-- 9. 引擎超时统计
-- SELECT p.player_name, AVG(think_time_ms) avg_time, MAX(think_time_ms) max_time
-- FROM t_move_record m
-- JOIN t_player p ON p.id = m.player_id
-- WHERE p.player_type = 2
-- GROUP BY m.player_id;

-- 10. 胜负原因分布
-- SELECT win_reason, COUNT(*) AS cnt
-- FROM t_game_record
-- WHERE status = 2 AND winner IS NOT NULL
-- GROUP BY win_reason
-- ORDER BY cnt DESC;
