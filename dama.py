import pygame
import sys
import copy
from enum import Enum
from typing import List, Tuple, Optional
import math

# Initialize Pygame
pygame.init()

# Constants
BOARD_SIZE = 8
SQUARE_SIZE = 100
BOARD_WIDTH = BOARD_SIZE * SQUARE_SIZE
BOARD_HEIGHT = BOARD_SIZE * SQUARE_SIZE
SIDEBAR_WIDTH = 300
WINDOW_WIDTH = BOARD_WIDTH + SIDEBAR_WIDTH
WINDOW_HEIGHT = BOARD_HEIGHT  # No extra space at bottom

# Colors
LIGHT_BROWN = (240, 217, 181)
DARK_BROWN = (181, 136, 99)
WHITE = (255, 255, 255)
BLACK = (50, 50, 50)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
GRAY = (128, 128, 128)
BUTTON_COLOR = (100, 100, 200)
HOVER_COLOR = (130, 130, 230)

class Difficulty(Enum):
    EASY = 2
    MEDIUM = 3
    HARD = 5

class PieceType(Enum):
    MAN = 1
    KING = 2

class Player(Enum):
    WHITE = 1
    BLACK = 2

class MenuScreen:
    def __init__(self, screen, font, small_font):
        self.screen = screen
        self.font = font
        self.small_font = small_font
        self.selected_difficulty = None
        self.buttons = {}
        self.title_text = self.font.render("Turkish Draughts AI", True, WHITE)
        self.subtitle_text = self.small_font.render("Select AI Difficulty", True, WHITE)
        self.logo_color = (70, 130, 180)
        # Layout parameters
        self.logo_y = WINDOW_HEIGHT // 2 - 200
        self.title_y = self.logo_y + 70
        self.subtitle_y = self.title_y + 50
        self.button_start_y = self.subtitle_y + 50
        self.button_height = 60
        self.button_width = 220
        self.button_spacing = 40
        for i, difficulty in enumerate(Difficulty):
            rect = pygame.Rect(
                WINDOW_WIDTH // 2 - self.button_width // 2,
                self.button_start_y + i * (self.button_height + self.button_spacing),
                self.button_width,
                self.button_height
            )
            self.buttons[difficulty] = rect

    def draw(self):
        # Draw semi-transparent overlay
        overlay = pygame.Surface((WINDOW_WIDTH, WINDOW_HEIGHT))
        overlay.set_alpha(210)
        overlay.fill((40, 40, 60))
        self.screen.blit(overlay, (0, 0))

        # Draw logo (simple circle)
        pygame.draw.circle(self.screen, self.logo_color, (WINDOW_WIDTH // 2, self.logo_y), 40)
        pygame.draw.circle(self.screen, WHITE, (WINDOW_WIDTH // 2, self.logo_y), 40, 3)

        # Draw title and subtitle
        self.screen.blit(self.title_text, self.title_text.get_rect(center=(WINDOW_WIDTH // 2, self.title_y)))
        self.screen.blit(self.subtitle_text, self.subtitle_text.get_rect(center=(WINDOW_WIDTH // 2, self.subtitle_y)))

        # Draw buttons
        for difficulty, rect in self.buttons.items():
            mouse_pos = pygame.mouse.get_pos()
            is_hover = rect.collidepoint(mouse_pos)
            color = HOVER_COLOR if is_hover else BUTTON_COLOR
            pygame.draw.rect(self.screen, color, rect, border_radius=18)
            pygame.draw.rect(self.screen, WHITE, rect, 3, border_radius=18)
            text = self.font.render(difficulty.name.title(), True, WHITE)
            text_rect = text.get_rect(center=rect.center)
            self.screen.blit(text, text_rect)
            # Show depth info
            #depth_text = self.small_font.render(f"Depth: {difficulty.value}", True, GRAY if not is_hover else YELLOW)
            #depth_rect = depth_text.get_rect(center=(rect.centerx, rect.centery + 22))
            #self.screen.blit(depth_text, depth_rect)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            for difficulty, rect in self.buttons.items():
                if rect.collidepoint(event.pos):
                    self.selected_difficulty = difficulty
                    return difficulty
        return None


class Piece:
    def __init__(self, player: Player, piece_type: PieceType = PieceType.MAN):
        self.player = player
        self.type = piece_type

    def __repr__(self):
        return f"{self.player.name}_{self.type.name}"

class Move:
    def __init__(self, start: Tuple[int, int], end: Tuple[int, int], captures: List[Tuple[int, int]] = None):
        self.start = start
        self.end = end
        self.captures = captures or []

    def __repr__(self):
        return f"Move({self.start} -> {self.end}, captures: {self.captures})"

class TurkishDraughts:
    def __init__(self):
        self.board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        self.current_player = Player.WHITE
        self.selected_piece = None
        self.valid_moves = []
        self.game_over = False
        self.winner = None
        self.captures_count = {Player.WHITE: 0, Player.BLACK: 0}
        # Animation variables
        self.animation_in_progress = False
        self.animation_start = None
        self.animation_end = None
        self.animation_captured_positions = []
        self.animation_timer = 0
        self.animation_duration = 20
        self.setup_board()

    def setup_board(self):
        """Initialize the board with correct starting positions"""
        self.board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        for row in range(5, 7):
            for col in range(8):
                self.board[row][col] = Piece(Player.WHITE)
        for row in range(1, 3):
            for col in range(8):
                self.board[row][col] = Piece(Player.BLACK)

    def get_piece_at(self, row: int, col: int) -> Optional[Piece]:
        if 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE:
            return self.board[row][col]
        return None

    def has_pieces(self, player: Player) -> bool:
        """Check if the given player has any pieces left on the board."""
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = self.board[row][col]
                if piece and piece.player == player:
                    return True
        return False
    def is_valid_position(self, row: int, col: int) -> bool:
        return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE

    def has_mandatory_captures(self) -> bool:
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = self.get_piece_at(row, col)
                if piece and piece.player == self.current_player:
                    if self.get_capture_moves(row, col):
                        return True
        return False

    def get_all_valid_moves(self) -> List[Move]:
        all_moves = []
        has_captures = self.has_mandatory_captures()
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = self.get_piece_at(row, col)
                if piece and piece.player == self.current_player:
                    if has_captures:
                        capture_moves = self.get_capture_moves(row, col)
                        if capture_moves:
                            all_moves.extend(capture_moves)
                    else:
                        all_moves.extend(self.get_regular_moves(row, col))
        if has_captures:
            if not all_moves:
                return []
            max_captures = max(len(move.captures) for move in all_moves)
            all_moves = [move for move in all_moves if len(move.captures) == max_captures]
        return all_moves

    def get_valid_moves_for_piece(self, row: int, col: int) -> List[Move]:
        piece = self.get_piece_at(row, col)
        if not piece or piece.player != self.current_player:
            return []
        has_mandatory_captures = self.has_mandatory_captures()
        if has_mandatory_captures:
            capture_moves = self.get_capture_moves(row, col)
            if capture_moves:
                max_captures = max(len(move.captures) for move in capture_moves)
                return [move for move in capture_moves if len(move.captures) == max_captures]
            else:
                return []
        else:
            return self.get_regular_moves(row, col)

    def get_regular_moves(self, row: int, col: int) -> List[Move]:
        piece = self.get_piece_at(row, col)
        moves = []
        if piece.type == PieceType.MAN:
            directions = []
            if piece.player == Player.WHITE:
                directions = [(-1, 0), (0, -1), (0, 1)]
            else:
                directions = [(1, 0), (0, -1), (0, 1)]
            for dr, dc in directions:
                new_row, new_col = row + dr, col + dc
                if self.is_valid_position(new_row, new_col) and self.get_piece_at(new_row, new_col) is None:
                    moves.append(Move((row, col), (new_row, new_col)))
        else:
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
            for dr, dc in directions:
                for distance in range(1, BOARD_SIZE):
                    new_row, new_col = row + dr * distance, col + dc * distance
                    if not self.is_valid_position(new_row, new_col):
                        break
                    if self.get_piece_at(new_row, new_col) is not None:
                        break
                    moves.append(Move((row, col), (new_row, new_col)))
        return moves

    def get_capture_moves(self, row: int, col: int) -> List[Move]:
        piece = self.get_piece_at(row, col)
        if not piece:
            return []
        if piece.type == PieceType.MAN:
            return self.get_man_captures(row, col)
        else:
            return self.get_king_captures(row, col)

    def get_man_captures(self, row: int, col: int) -> List[Move]:
        captures = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dr, dc in directions:
            enemy_row, enemy_col = row + dr, col + dc
            landing_row, landing_col = row + dr * 2, col + dc * 2
            if self.is_valid_position(enemy_row, enemy_col) and self.is_valid_position(landing_row, landing_col):
                enemy_piece = self.get_piece_at(enemy_row, enemy_col)
                landing_square = self.get_piece_at(landing_row, landing_col)
                if enemy_piece and enemy_piece.player != self.current_player and landing_square is None:
                    initial_move = Move((row, col), (landing_row, landing_col), [(enemy_row, enemy_col)])
                    all_sequences = self.find_all_sequences(initial_move)
                    if all_sequences:
                        max_captures = max(len(seq.captures) for seq in all_sequences)
                        best_sequences = [seq for seq in all_sequences if len(seq.captures) == max_captures]
                        captures.extend(best_sequences)
                    else:
                        captures.append(initial_move)
        return captures

    def find_all_sequences(self, move: Move) -> List[Move]:
        sequences = []
        temp_board = copy.deepcopy(self.board)
        for cap_row, cap_col in move.captures:
            temp_board[cap_row][cap_col] = None
        piece = temp_board[move.start[0]][move.start[1]]
        temp_board[move.start[0]][move.start[1]] = None
        temp_board[move.end[0]][move.end[1]] = piece
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dr, dc in directions:
            enemy_row, enemy_col = move.end[0] + dr, move.end[1] + dc
            landing_row, landing_col = move.end[0] + dr * 2, move.end[1] + dc * 2
            if self.is_valid_position(enemy_row, enemy_col) and self.is_valid_position(landing_row, landing_col):
                enemy_piece = temp_board[enemy_row][enemy_col]
                landing_square = temp_board[landing_row][landing_col]
                if enemy_piece and enemy_piece.player != self.current_player and landing_square is None and (enemy_row, enemy_col) not in move.captures:
                    new_move = Move(move.start, (landing_row, landing_col), move.captures + [(enemy_row, enemy_col)])
                    sub_sequences = self.find_all_sequences(new_move)
                    if sub_sequences:
                        sequences.extend(sub_sequences)
                    else:
                        sequences.append(new_move)
        return sequences

    def get_king_captures(self, row: int, col: int) -> List[Move]:
        captures = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dr, dc in directions:
            for distance in range(1, BOARD_SIZE):
                check_row, check_col = row + dr * distance, col + dc * distance
                if not self.is_valid_position(check_row, check_col):
                    break
                piece_at_pos = self.get_piece_at(check_row, check_col)
                if piece_at_pos:
                    if piece_at_pos.player != self.current_player:
                        for land_distance in range(1, BOARD_SIZE - distance):
                            land_row = check_row + dr * land_distance
                            land_col = check_col + dc * land_distance
                            if not self.is_valid_position(land_row, land_col):
                                break
                            if self.get_piece_at(land_row, land_col) is None:
                                move = Move((row, col), (land_row, land_col), [(check_row, check_col)])
                                self.extend_king_capture_sequence(move, land_row, land_col, (dr, dc))
                                captures.append(move)
                            else:
                                break
                    break
        return captures

    def extend_king_capture_sequence(self, move: Move, row: int, col: int, last_direction: Tuple[int, int]):
        temp_board = copy.deepcopy(self.board)
        for cap_row, cap_col in move.captures:
            temp_board[cap_row][cap_col] = None
        piece = temp_board[move.start[0]][move.start[1]]
        temp_board[move.start[0]][move.start[1]] = None
        temp_board[row][col] = piece
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        forbidden_direction = (-last_direction[0], -last_direction[1])
        for dr, dc in directions:
            if (dr, dc) == forbidden_direction:
                continue
            for distance in range(1, BOARD_SIZE):
                check_row, check_col = row + dr * distance, col + dc * distance
                if not self.is_valid_position(check_row, check_col):
                    break
                piece_at_pos = temp_board[check_row][check_col]
                if piece_at_pos:
                    if piece_at_pos.player != self.current_player and (check_row, check_col) not in move.captures:
                        for land_distance in range(1, BOARD_SIZE - distance):
                            land_row = check_row + dr * land_distance
                            land_col = check_col + dc * land_distance
                            if not self.is_valid_position(land_row, land_col):
                                break
                            if temp_board[land_row][land_col] is None:
                                extended_move = Move(move.start, (land_row, land_col),
                                                     move.captures + [(check_row, check_col)])
                                self.extend_king_capture_sequence(extended_move, land_row, land_col, (dr, dc))
                                move.end = extended_move.end
                                move.captures = extended_move.captures
                                return
                            else:
                                break
                    break

    def make_move(self, move: Move) -> bool:
        start_row, start_col = move.start
        end_row, end_col = move.end
        piece = self.get_piece_at(start_row, start_col)
        if not piece:
            return False
        self.board[start_row][start_col] = None
        captured_positions = []
        for cap_row, cap_col in move.captures:
            captured_piece = self.get_piece_at(cap_row, cap_col)
            if captured_piece:
                self.captures_count[self.current_player] += 1
            self.board[cap_row][cap_col] = None
            captured_positions.append((cap_row, cap_col))
        self.board[end_row][end_col] = piece
        if piece.type == PieceType.MAN:
            if ((piece.player == Player.WHITE and end_row == 0) or
                (piece.player == Player.BLACK and end_row == BOARD_SIZE - 1)):
                piece.type = PieceType.KING
        self.animation_in_progress = True
        self.animation_start = move.start
        self.animation_end = move.end
        self.animation_captured_positions = captured_positions
        self.animation_timer = 0
        self.current_player = Player.BLACK if self.current_player == Player.WHITE else Player.WHITE
        self.check_game_over()
        return True

    def check_game_over(self):
        # Check if current player has any pieces left
        if not self.has_pieces(self.current_player):
            self.game_over = True
            self.winner = Player.BLACK if self.current_player == Player.WHITE else Player.WHITE
            return

        # Regular check for valid moves
        valid_moves = self.get_all_valid_moves()
        if not valid_moves:
            self.game_over = True
            self.winner = Player.BLACK if self.current_player == Player.WHITE else Player.WHITE

    def reset_game(self):
        self.board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        self.current_player = Player.WHITE
        self.selected_piece = None
        self.valid_moves = []
        self.game_over = False
        self.winner = None
        self.captures_count = {Player.WHITE: 0, Player.BLACK: 0}
        self.animation_in_progress = False
        self.animation_start = None
        self.animation_end = None
        self.animation_captured_positions = []
        self.animation_timer = 0
        self.setup_board()


class TurkishDraughtsAI:
    def __init__(self, player: Player, difficulty: Difficulty = Difficulty.MEDIUM):
        self.player = player
        self.opponent = Player.BLACK if player == Player.WHITE else Player.WHITE
        self.max_depth = difficulty.value
        self.piece_values = {
            PieceType.MAN: 100,
            PieceType.KING: 300
        }

    def get_best_move(self, game: 'TurkishDraughts') -> Optional[Move]:
        if game.current_player != self.player:
            return None
        valid_moves = game.get_all_valid_moves()
        if not valid_moves:
            return None
        best_move = None
        best_score = float('-inf')
        alpha = float('-inf')
        beta = float('inf')
        for move in valid_moves:
            game_copy = self._copy_game_state(game)
            game_copy.make_move(move)
            score = self._minimax(game_copy, self.max_depth - 1, alpha, beta, False)
            if score > best_score:
                best_score = score
                best_move = move
            alpha = max(alpha, score)
            if beta <= alpha:
                break
        return best_move

    def _minimax(self, game: 'TurkishDraughts', depth: int, alpha: float, beta: float, maximizing: bool) -> float:
        if depth == 0 or game.game_over:
            return self._evaluate_position(game)
        valid_moves = game.get_all_valid_moves()
        if not valid_moves:
            return float('-inf') if maximizing else float('inf')
        if maximizing:
            max_eval = float('-inf')
            for move in valid_moves:
                game_copy = self._copy_game_state(game)
                game_copy.make_move(move)
                eval_score = self._minimax(game_copy, depth - 1, alpha, beta, False)
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for move in valid_moves:
                game_copy = self._copy_game_state(game)
                game_copy.make_move(move)
                eval_score = self._minimax(game_copy, depth - 1, alpha, beta, True)
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break
            return min_eval

    def _evaluate_position(self, game: 'TurkishDraughts') -> float:
        if game.game_over:
            if game.winner == self.player:
                return 10000
            elif game.winner == self.opponent:
                return -10000
            else:
                return 0
        score = 0
        ai_pieces = {'men': 0, 'kings': 0}
        opponent_pieces = {'men': 0, 'kings': 0}
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = game.get_piece_at(row, col)
                if piece:
                    piece_value = self.piece_values[piece.type]
                    position_bonus = self._get_position_bonus(row, col, piece)
                    total_value = piece_value + position_bonus
                    if piece.player == self.player:
                        score += total_value
                        if piece.type == PieceType.MAN:
                            ai_pieces['men'] += 1
                        else:
                            ai_pieces['kings'] += 1
                    else:
                        score -= total_value
                        if piece.type == PieceType.MAN:
                            opponent_pieces['men'] += 1
                        else:
                            opponent_pieces['kings'] += 1
        if game.current_player == self.player:
            ai_moves = len(game.get_all_valid_moves())
            score += ai_moves * 5
        else:
            opponent_moves = len(game.get_all_valid_moves())
            score -= opponent_moves * 5
        score += self._get_king_advancement_bonus(game)
        score += (game.captures_count[self.player] - game.captures_count[self.opponent]) * 50
        return score

    def _get_position_bonus(self, row: int, col: int, piece: Piece) -> float:
        bonus = 0
        if piece.type == PieceType.MAN:
            if piece.player == Player.WHITE:
                bonus += (BOARD_SIZE - 1 - row) * 2
            else:
                bonus += row * 2
            center_distance = abs(row - 3.5) + abs(col - 3.5)
            bonus += max(0, 7 - center_distance) * 3
        else:
            center_distance = abs(row - 3.5) + abs(col - 3.5)
            bonus += max(0, 7 - center_distance) * 5
            if row == 0 or row == BOARD_SIZE - 1 or col == 0 or col == BOARD_SIZE - 1:
                bonus -= 10
        return bonus

    def _get_king_advancement_bonus(self, game: 'TurkishDraughts') -> float:
        bonus = 0
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = game.get_piece_at(row, col)
                if piece and piece.type == PieceType.MAN:
                    if piece.player == self.player:
                        if self.player == Player.WHITE and row <= 2:
                            bonus += (3 - row) * 20
                        elif self.player == Player.BLACK and row >= 5:
                            bonus += (row - 4) * 20
                    else:
                        if piece.player == Player.WHITE and row <= 2:
                            bonus -= (3 - row) * 20
                        elif piece.player == Player.BLACK and row >= 5:
                            bonus -= (row - 4) * 20
        return bonus

    def _copy_game_state(self, game: 'TurkishDraughts') -> 'TurkishDraughts':
        game_copy = TurkishDraughts()
        game_copy.board = copy.deepcopy(game.board)
        game_copy.current_player = game.current_player
        game_copy.game_over = game.game_over
        game_copy.winner = game.winner
        game_copy.captures_count = game.captures_count.copy()
        game_copy.selected_piece = None
        game_copy.valid_moves = []
        game_copy.animation_in_progress = False
        game_copy.animation_start = None
        game_copy.animation_end = None
        game_copy.animation_captured_positions = []
        game_copy.animation_timer = 0
        return game_copy

class GameGUI:
    def __init__(self, difficulty=Difficulty.MEDIUM):
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("Turkish Draughts (Dama)")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 28)
        self.game = TurkishDraughts()
        self.ai = TurkishDraughtsAI(Player.BLACK, difficulty)
        self.ai_thinking = False
        self.ai_delay_counter = 0
        self.ai_move_delay = 60
        self.reset_button_rect = None
        self.difficulty = difficulty
        # Evaluation bar state
        self.eval_bar_value = 0.5  # 0.0 = black, 1.0 = white
        self.eval_bar_target = 0.5



    def draw_board(self):
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                x = 20 + col * SQUARE_SIZE  # Shift right for eval bar
                y = row * SQUARE_SIZE
                color = LIGHT_BROWN if (row + col) % 2 == 0 else DARK_BROWN
                pygame.draw.rect(self.screen, color, (x, y, SQUARE_SIZE, SQUARE_SIZE))

    def draw_pieces(self):
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = self.game.get_piece_at(row, col)
                if piece:
                    if self.game.animation_in_progress and (row, col) in self.game.animation_captured_positions:
                        continue
                    x = 20 + col * SQUARE_SIZE + SQUARE_SIZE // 2
                    y = row * SQUARE_SIZE + SQUARE_SIZE // 2
                    color = WHITE if piece.player == Player.WHITE else BLACK
                    border_color = BLACK if piece.player == Player.WHITE else WHITE
                    pygame.draw.circle(self.screen, color, (x, y), 40)
                    pygame.draw.circle(self.screen, border_color, (x, y), 40, 3)
                    if piece.type == PieceType.KING:
                        crown_color = YELLOW
                        pygame.draw.circle(self.screen, crown_color, (x, y), 15)
                        pygame.draw.circle(self.screen, border_color, (x, y), 15, 2)
        if self.game.animation_in_progress:
            progress = min(1.0, self.game.animation_timer / self.game.animation_duration)
            start_row, start_col = self.game.animation_start
            end_row, end_col = self.game.animation_end
            x = 20 + start_col * SQUARE_SIZE + progress * (end_col - start_col) * SQUARE_SIZE
            y = start_row * SQUARE_SIZE + progress * (end_row - start_row) * SQUARE_SIZE
            jump_height = 40 * math.sin(math.pi * progress)
            x_center = x + SQUARE_SIZE // 2
            y_center = y + SQUARE_SIZE // 2 - jump_height
            piece = self.game.board[end_row][end_col]
            if piece:
                color = WHITE if piece.player == Player.WHITE else BLACK
                border_color = BLACK if piece.player == Player.WHITE else WHITE
                pygame.draw.circle(self.screen, color, (int(x_center), int(y_center)), 40)
                pygame.draw.circle(self.screen, border_color, (int(x_center), int(y_center)), 40, 3)
                if piece.type == PieceType.KING:
                    crown_color = YELLOW
                    pygame.draw.circle(self.screen, crown_color, (int(x_center), int(y_center)), 15)
                    pygame.draw.circle(self.screen, border_color, (int(x_center), int(y_center)), 15, 2)
        if self.game.animation_in_progress:
            for cap_row, cap_col in self.game.animation_captured_positions:
                alpha = max(0, 255 - int(self.game.animation_timer * 255 / self.game.animation_duration))
                fade_surface = pygame.Surface((SQUARE_SIZE, SQUARE_SIZE), pygame.SRCALPHA)
                piece = self.game.get_piece_at(cap_row, cap_col)
                if piece:
                    color = WHITE if piece.player == Player.WHITE else BLACK
                    pygame.draw.circle(fade_surface, (*color, alpha), (SQUARE_SIZE // 2, SQUARE_SIZE // 2), 40)
                    self.screen.blit(fade_surface, (20 + cap_col * SQUARE_SIZE, cap_row * SQUARE_SIZE))

    def draw_highlights(self):
        if self.game.selected_piece:
            row, col = self.game.selected_piece
            x = 20 + col * SQUARE_SIZE
            y = row * SQUARE_SIZE
            pygame.draw.rect(self.screen, BLUE, (x, y, SQUARE_SIZE, SQUARE_SIZE), 5)
        for move in self.game.valid_moves:
            end_row, end_col = move.end
            x = 20 + end_col * SQUARE_SIZE
            y = end_row * SQUARE_SIZE
            pygame.draw.rect(self.screen, GREEN, (x, y, SQUARE_SIZE, SQUARE_SIZE), 4)
            for cap_row, cap_col in move.captures:
                x_cap = 20 + cap_col * SQUARE_SIZE
                y_cap = cap_row * SQUARE_SIZE
                pygame.draw.rect(self.screen, RED, (x_cap, y_cap, SQUARE_SIZE, SQUARE_SIZE), 4)

    def draw_sidebar(self):
        sidebar_x = 20 + BOARD_WIDTH
        pygame.draw.rect(self.screen, GRAY, (sidebar_x, 0, SIDEBAR_WIDTH, WINDOW_HEIGHT))
        y_offset = 20
        player_text = f"Current Player: {self.game.current_player.name}"
        text_surface = self.font.render(player_text, True, WHITE)
        self.screen.blit(text_surface, (sidebar_x + 10, y_offset))
        y_offset += 50
        white_captures = f"White Captures: {self.game.captures_count[Player.WHITE]}"
        black_captures = f"Black Captures: {self.game.captures_count[Player.BLACK]}"
        white_text = self.small_font.render(white_captures, True, WHITE)
        black_text = self.small_font.render(black_captures, True, WHITE)
        self.screen.blit(white_text, (sidebar_x + 10, y_offset))
        y_offset += 30
        self.screen.blit(black_text, (sidebar_x + 10, y_offset))
        y_offset += 50
        if self.game.game_over:
            winner_text = f"Winner: {self.game.winner.name}" if self.game.winner else "Draw"
            winner_surface = self.font.render(winner_text, True, YELLOW)
            self.screen.blit(winner_surface, (sidebar_x + 10, y_offset))
            y_offset += 50
        ai_status = "AI: ON"
        ai_color = GREEN
        ai_text = self.font.render(ai_status, True, ai_color)
        self.screen.blit(ai_text, (sidebar_x + 10, y_offset))
        y_offset += 40
        self.reset_button_rect = pygame.Rect(sidebar_x + 10, y_offset, 150, 40)
        pygame.draw.rect(self.screen, BUTTON_COLOR, self.reset_button_rect)
        reset_text = self.font.render("Reset", True, WHITE)
        text_rect = reset_text.get_rect(center=self.reset_button_rect.center)
        self.screen.blit(reset_text, text_rect)
        y_offset += 50
        if self.ai_thinking:
            thinking_text = self.small_font.render("AI Thinking...", True, YELLOW)
            self.screen.blit(thinking_text, (sidebar_x + 10, y_offset))

    def handle_click(self, pos):
        x, y = pos
        if x < 20 or x >= 20 + BOARD_WIDTH or y < 0 or y >= BOARD_HEIGHT:
            return
        col = (x - 20) // SQUARE_SIZE
        row = y // SQUARE_SIZE
        if self.game.game_over:
            return
        if self.game.selected_piece is None:
            piece = self.game.get_piece_at(row, col)
            if piece and piece.player == self.game.current_player:
                self.game.selected_piece = (row, col)
                self.game.valid_moves = self.game.get_valid_moves_for_piece(row, col)
        else:
            clicked_move = None
            for move in self.game.valid_moves:
                if move.end == (row, col):
                    clicked_move = move
                    break
            if clicked_move:
                self.game.make_move(clicked_move)
                self.game.selected_piece = None
                self.game.valid_moves = []
            else:
                piece = self.game.get_piece_at(row, col)
                if piece and piece.player == self.game.current_player:
                    self.game.selected_piece = (row, col)
                    self.game.valid_moves = self.game.get_valid_moves_for_piece(row, col)
                else:
                    self.game.selected_piece = None
                    self.game.valid_moves = []

    def run(self):
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if event.button == 1:
                        pos = pygame.mouse.get_pos()
                        if self.reset_button_rect.collidepoint(pos):
                            self.game.reset_game()
                        else:
                            in_board = 20 <= pos[0] < 20 + BOARD_WIDTH and pos[1] < BOARD_HEIGHT
                            if in_board and self.game.current_player != self.ai.player:
                                self.handle_click(pos)
            if self.ai and self.game.current_player == self.ai.player and not self.game.game_over:
                if not self.game.animation_in_progress:
                    if not self.ai_thinking:
                        self.ai_thinking = True
                        self.ai_delay_counter = 0
                    self.ai_delay_counter += 1
                    if self.ai_delay_counter >= self.ai_move_delay:
                        ai_move = self.ai.get_best_move(self.game)
                        if ai_move:
                            self.game.make_move(ai_move)
                        self.ai_thinking = False
                        self.ai_delay_counter = 0

            self.screen.fill(GRAY)

            self.draw_board()
            self.draw_pieces()
            self.draw_highlights()
            self.draw_sidebar()
            if self.game.animation_in_progress:
                self.game.animation_timer += 1
                if self.game.animation_timer >= self.game.animation_duration:
                    self.game.animation_in_progress = False
            pygame.display.flip()
            self.clock.tick(60)
        pygame.quit()
        sys.exit()



if __name__ == "__main__":
    pygame.init()
    screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
    font = pygame.font.Font(None, 36)
    small_font = pygame.font.Font(None, 28)
    menu = MenuScreen(screen, font, small_font)
    difficulty = None
    while difficulty is None:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            result = menu.handle_event(event)
            if result:
                difficulty = result
        menu.draw()
        pygame.display.flip()
        pygame.time.Clock().tick(60)
    game_gui = GameGUI(difficulty)
    game_gui.run()