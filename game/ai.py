"""
TurkishDraughtsAI - AI opponent for Turkish Draughts.

This module contains the AI implementation using minimax algorithm
with alpha-beta pruning. No external dependencies.
"""

from typing import Optional, TYPE_CHECKING

from game.types import Player, PieceType, Difficulty, Move, Piece

if TYPE_CHECKING:
    from game.board import TurkishDraughts


# Board constant (must match board.py)
BOARD_SIZE = 8


class TurkishDraughtsAI:
    """
    AI opponent for Turkish Draughts using minimax with alpha-beta pruning.
    
    Attributes:
        player: The player color this AI controls
        opponent: The opposing player color
        max_depth: Search depth (determined by difficulty)
    """
    
    def __init__(
        self, 
        player: Player, 
        difficulty: Difficulty = Difficulty.MEDIUM
    ) -> None:
        """
        Initialize the AI.
        
        Args:
            player: Which player the AI controls (WHITE or BLACK)
            difficulty: AI strength level (affects search depth)
        """
        self.player = player
        self.opponent = Player.BLACK if player == Player.WHITE else Player.WHITE
        self.max_depth = difficulty.value
        self.piece_values = {
            PieceType.MAN: 100,
            PieceType.KING: 300
        }
    
    def get_best_move(self, game: 'TurkishDraughts') -> Optional[Move]:
        """
        Calculate the best move for the current position.
        
        Args:
            game: Current game state
            
        Returns:
            The best move found, or None if no moves available
        """
        if game.current_player != self.player:
            return None
        
        valid_moves = game.get_all_valid_moves()
        if not valid_moves:
            return None
        
        best_move: Optional[Move] = None
        best_score = float('-inf')
        alpha = float('-inf')
        beta = float('inf')
        
        for move in valid_moves:
            game_copy = game.copy()
            game_copy.make_move(move)
            score = self._minimax(game_copy, self.max_depth - 1, alpha, beta, False)
            
            if score > best_score:
                best_score = score
                best_move = move
            
            alpha = max(alpha, score)
            if beta <= alpha:
                break
        
        return best_move
    
    def _minimax(
        self, 
        game: 'TurkishDraughts', 
        depth: int, 
        alpha: float, 
        beta: float, 
        maximizing: bool
    ) -> float:
        """
        Minimax algorithm with alpha-beta pruning.
        
        Args:
            game: Current game state
            depth: Remaining search depth
            alpha: Alpha value for pruning
            beta: Beta value for pruning
            maximizing: True if maximizing player's turn
            
        Returns:
            Evaluation score for the position
        """
        if depth == 0 or game.game_over:
            return self._evaluate_position(game)
        
        valid_moves = game.get_all_valid_moves()
        if not valid_moves:
            return float('-inf') if maximizing else float('inf')
        
        if maximizing:
            max_eval = float('-inf')
            for move in valid_moves:
                game_copy = game.copy()
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
                game_copy = game.copy()
                game_copy.make_move(move)
                eval_score = self._minimax(game_copy, depth - 1, alpha, beta, True)
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break
            return min_eval
    
    def _evaluate_position(self, game: 'TurkishDraughts') -> float:
        """
        Evaluate the current board position.
        
        Args:
            game: Game state to evaluate
            
        Returns:
            Score from AI's perspective (positive = AI advantage)
        """
        # Check for game over
        if game.game_over:
            if game.winner == self.player:
                return 10000
            elif game.winner == self.opponent:
                return -10000
            else:
                return 0
        
        score = 0.0
        
        # Count pieces and calculate material + position scores
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = game.get_piece_at(row, col)
                if piece:
                    piece_value = self.piece_values[piece.type]
                    position_bonus = self._get_position_bonus(row, col, piece)
                    total_value = piece_value + position_bonus
                    
                    if piece.player == self.player:
                        score += total_value
                    else:
                        score -= total_value
        
        # Mobility bonus
        if game.current_player == self.player:
            ai_moves = len(game.get_all_valid_moves())
            score += ai_moves * 5
        else:
            opponent_moves = len(game.get_all_valid_moves())
            score -= opponent_moves * 5
        
        # King advancement bonus
        score += self._get_king_advancement_bonus(game)
        
        # Capture difference bonus
        score += (
            game.captures_count[self.player] - 
            game.captures_count[self.opponent]
        ) * 50
        
        return score
    
    def _get_position_bonus(self, row: int, col: int, piece: Piece) -> float:
        """
        Calculate position bonus for a piece.
        
        Args:
            row: Row position
            col: Column position
            piece: The piece to evaluate
            
        Returns:
            Position bonus value
        """
        bonus = 0.0
        
        if piece.type == PieceType.MAN:
            # Advancement bonus for men
            if piece.player == Player.WHITE:
                bonus += (BOARD_SIZE - 1 - row) * 2
            else:
                bonus += row * 2
            
            # Center control bonus
            center_distance = abs(row - 3.5) + abs(col - 3.5)
            bonus += max(0, 7 - center_distance) * 3
        else:
            # King center control
            center_distance = abs(row - 3.5) + abs(col - 3.5)
            bonus += max(0, 7 - center_distance) * 5
            
            # Penalty for edge positions
            if row == 0 or row == BOARD_SIZE - 1 or col == 0 or col == BOARD_SIZE - 1:
                bonus -= 10
        
        return bonus
    
    def _get_king_advancement_bonus(self, game: 'TurkishDraughts') -> float:
        """
        Calculate bonus for pieces close to promotion.
        
        Args:
            game: Current game state
            
        Returns:
            Advancement bonus value
        """
        bonus = 0.0
        
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = game.get_piece_at(row, col)
                if piece and piece.type == PieceType.MAN:
                    if piece.player == self.player:
                        # Bonus for AI pieces close to promotion
                        if self.player == Player.WHITE and row <= 2:
                            bonus += (3 - row) * 20
                        elif self.player == Player.BLACK and row >= 5:
                            bonus += (row - 4) * 20
                    else:
                        # Penalty for opponent pieces close to promotion
                        if piece.player == Player.WHITE and row <= 2:
                            bonus -= (3 - row) * 20
                        elif piece.player == Player.BLACK and row >= 5:
                            bonus -= (row - 4) * 20
        
        return bonus
