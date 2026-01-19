"""
TurkishDraughts game logic.

This module contains the core game rules for Turkish Draughts (Dama).
Pure Python implementation with no UI dependencies.
"""

import copy
from typing import List, Tuple, Optional

from game.types import Piece, Move, Player, PieceType


# Board constants
BOARD_SIZE = 8


class TurkishDraughts:
    """
    Turkish Draughts (Dama) game board and rules.
    
    Turkish Draughts differs from Western Checkers:
    - Pieces move orthogonally (horizontal/vertical), not diagonally
    - Man pieces can move forward or sideways, but not backward
    - King pieces can move any distance in all 4 orthogonal directions
    - Captures are mandatory
    - If multiple capture paths exist, the longest chain must be taken
    """
    
    def __init__(self) -> None:
        """Initialize a new game board."""
        self.board: List[List[Optional[Piece]]] = [
            [None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)
        ]
        self.current_player: Player = Player.WHITE
        self.game_over: bool = False
        self.winner: Optional[Player] = None
        self.captures_count: dict = {Player.WHITE: 0, Player.BLACK: 0}
        self.setup_board()
    
    def setup_board(self) -> None:
        """Initialize the board with correct starting positions."""
        self.board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        # WHITE pieces on rows 5-6 (indices 5, 6)
        for row in range(5, 7):
            for col in range(BOARD_SIZE):
                self.board[row][col] = Piece(player=Player.WHITE, type=PieceType.MAN)
        # BLACK pieces on rows 1-2 (indices 1, 2)
        for row in range(1, 3):
            for col in range(BOARD_SIZE):
                self.board[row][col] = Piece(player=Player.BLACK, type=PieceType.MAN)
    
    def get_piece_at(self, row: int, col: int) -> Optional[Piece]:
        """Get piece at the specified position."""
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
        """Check if position is within board bounds."""
        return 0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE
    
    def has_mandatory_captures(self) -> bool:
        """Check if current player has any capture moves available."""
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                piece = self.get_piece_at(row, col)
                if piece and piece.player == self.current_player:
                    if self.get_capture_moves(row, col):
                        return True
        return False
    
    def get_all_valid_moves(self) -> List[Move]:
        """
        Get all valid moves for the current player.
        
        If captures are available, only capture moves are returned.
        When multiple capture paths exist, only the longest chains are returned.
        """
        all_moves: List[Move] = []
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
        
        # If captures exist, filter to keep only maximum length chains
        if has_captures and all_moves:
            max_captures = max(len(move.captures) for move in all_moves)
            all_moves = [move for move in all_moves if len(move.captures) == max_captures]
        
        return all_moves
    
    def get_valid_moves_for_piece(self, row: int, col: int) -> List[Move]:
        """Get valid moves for a specific piece."""
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
        """Get non-capture moves for a piece."""
        piece = self.get_piece_at(row, col)
        if not piece:
            return []
        
        moves: List[Move] = []
        
        if piece.type == PieceType.MAN:
            # Man can move forward and sideways, but not backward
            if piece.player == Player.WHITE:
                directions = [(-1, 0), (0, -1), (0, 1)]  # Up, Left, Right
            else:
                directions = [(1, 0), (0, -1), (0, 1)]   # Down, Left, Right
            
            for dr, dc in directions:
                new_row, new_col = row + dr, col + dc
                if self.is_valid_position(new_row, new_col) and self.get_piece_at(new_row, new_col) is None:
                    moves.append(Move(start=(row, col), end=(new_row, new_col)))
        else:
            # King can move any distance in all 4 orthogonal directions
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
            for dr, dc in directions:
                for distance in range(1, BOARD_SIZE):
                    new_row, new_col = row + dr * distance, col + dc * distance
                    if not self.is_valid_position(new_row, new_col):
                        break
                    if self.get_piece_at(new_row, new_col) is not None:
                        break
                    moves.append(Move(start=(row, col), end=(new_row, new_col)))
        
        return moves
    
    def get_capture_moves(self, row: int, col: int) -> List[Move]:
        """Get capture moves for a piece."""
        piece = self.get_piece_at(row, col)
        if not piece:
            return []
        
        if piece.type == PieceType.MAN:
            return self._get_man_captures(row, col)
        else:
            return self._get_king_captures(row, col)
    
    def _get_man_captures(self, row: int, col: int) -> List[Move]:
        """Get capture moves for a Man piece."""
        captures: List[Move] = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        
        for dr, dc in directions:
            enemy_row, enemy_col = row + dr, col + dc
            landing_row, landing_col = row + dr * 2, col + dc * 2
            
            if (self.is_valid_position(enemy_row, enemy_col) and 
                self.is_valid_position(landing_row, landing_col)):
                enemy_piece = self.get_piece_at(enemy_row, enemy_col)
                landing_square = self.get_piece_at(landing_row, landing_col)
                
                if (enemy_piece and 
                    enemy_piece.player != self.current_player and 
                    landing_square is None):
                    initial_move = Move(
                        start=(row, col), 
                        end=(landing_row, landing_col), 
                        captures=[(enemy_row, enemy_col)]
                    )
                    # Find chain captures
                    all_sequences = self._find_all_capture_sequences(initial_move)
                    if all_sequences:
                        max_caps = max(len(seq.captures) for seq in all_sequences)
                        best_sequences = [s for s in all_sequences if len(s.captures) == max_caps]
                        captures.extend(best_sequences)
                    else:
                        captures.append(initial_move)
        
        return captures
    
    def _find_all_capture_sequences(self, move: Move) -> List[Move]:
        """Recursively find all possible capture sequences from a given move."""
        sequences: List[Move] = []
        
        # Create temporary board state
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
            
            if (self.is_valid_position(enemy_row, enemy_col) and 
                self.is_valid_position(landing_row, landing_col)):
                enemy_piece = temp_board[enemy_row][enemy_col]
                landing_square = temp_board[landing_row][landing_col]
                
                if (enemy_piece and 
                    enemy_piece.player != self.current_player and 
                    landing_square is None and 
                    (enemy_row, enemy_col) not in move.captures):
                    new_move = Move(
                        start=move.start, 
                        end=(landing_row, landing_col), 
                        captures=move.captures + [(enemy_row, enemy_col)]
                    )
                    sub_sequences = self._find_all_capture_sequences(new_move)
                    if sub_sequences:
                        sequences.extend(sub_sequences)
                    else:
                        sequences.append(new_move)
        
        return sequences
    
    def _get_king_captures(self, row: int, col: int) -> List[Move]:
        """Get capture moves for a King piece."""
        captures: List[Move] = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        
        for dr, dc in directions:
            for distance in range(1, BOARD_SIZE):
                check_row, check_col = row + dr * distance, col + dc * distance
                
                if not self.is_valid_position(check_row, check_col):
                    break
                
                piece_at_pos = self.get_piece_at(check_row, check_col)
                
                if piece_at_pos:
                    if piece_at_pos.player != self.current_player:
                        # Found enemy, look for landing squares
                        for land_distance in range(1, BOARD_SIZE - distance):
                            land_row = check_row + dr * land_distance
                            land_col = check_col + dc * land_distance
                            
                            if not self.is_valid_position(land_row, land_col):
                                break
                            
                            if self.get_piece_at(land_row, land_col) is None:
                                move = Move(
                                    start=(row, col), 
                                    end=(land_row, land_col), 
                                    captures=[(check_row, check_col)]
                                )
                                self._extend_king_capture_sequence(
                                    move, land_row, land_col, (dr, dc)
                                )
                                captures.append(move)
                            else:
                                break
                    break
        
        return captures
    
    def _extend_king_capture_sequence(
        self, 
        move: Move, 
        row: int, 
        col: int, 
        last_direction: Tuple[int, int]
    ) -> None:
        """Recursively extend a King's capture sequence."""
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
                    if (piece_at_pos.player != self.current_player and 
                        (check_row, check_col) not in move.captures):
                        for land_distance in range(1, BOARD_SIZE - distance):
                            land_row = check_row + dr * land_distance
                            land_col = check_col + dc * land_distance
                            
                            if not self.is_valid_position(land_row, land_col):
                                break
                            
                            if temp_board[land_row][land_col] is None:
                                extended_move = Move(
                                    start=move.start, 
                                    end=(land_row, land_col),
                                    captures=move.captures + [(check_row, check_col)]
                                )
                                self._extend_king_capture_sequence(
                                    extended_move, land_row, land_col, (dr, dc)
                                )
                                move.end = extended_move.end
                                move.captures = extended_move.captures
                                return
                            else:
                                break
                    break
    
    def make_move(self, move: Move) -> bool:
        """
        Execute a move on the board.
        
        Args:
            move: The move to execute
            
        Returns:
            True if move was successful, False otherwise
        """
        start_row, start_col = move.start
        end_row, end_col = move.end
        piece = self.get_piece_at(start_row, start_col)
        
        if not piece:
            return False
        
        # Move piece
        self.board[start_row][start_col] = None
        
        # Remove captured pieces
        for cap_row, cap_col in move.captures:
            if self.get_piece_at(cap_row, cap_col):
                self.captures_count[self.current_player] += 1
            self.board[cap_row][cap_col] = None
        
        # Place piece at destination
        self.board[end_row][end_col] = piece
        
        # Check for promotion
        if piece.type == PieceType.MAN:
            if ((piece.player == Player.WHITE and end_row == 0) or
                (piece.player == Player.BLACK and end_row == BOARD_SIZE - 1)):
                piece.type = PieceType.KING
        
        # Switch player
        self.current_player = (
            Player.BLACK if self.current_player == Player.WHITE else Player.WHITE
        )
        
        # Check for game over
        self.check_game_over()
        
        return True
    
    def check_game_over(self) -> None:
        """Check if the game has ended."""
        # Check if current player has any pieces left
        if not self.has_pieces(self.current_player):
            self.game_over = True
            self.winner = (
                Player.BLACK if self.current_player == Player.WHITE else Player.WHITE
            )
            return
        
        # Check if current player has any valid moves
        valid_moves = self.get_all_valid_moves()
        if not valid_moves:
            self.game_over = True
            self.winner = (
                Player.BLACK if self.current_player == Player.WHITE else Player.WHITE
            )
    
    def reset_game(self) -> None:
        """Reset the game to initial state."""
        self.board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]
        self.current_player = Player.WHITE
        self.game_over = False
        self.winner = None
        self.captures_count = {Player.WHITE: 0, Player.BLACK: 0}
        self.setup_board()
    
    def copy(self) -> 'TurkishDraughts':
        """Create a deep copy of the current game state."""
        game_copy = TurkishDraughts()
        game_copy.board = copy.deepcopy(self.board)
        game_copy.current_player = self.current_player
        game_copy.game_over = self.game_over
        game_copy.winner = self.winner
        game_copy.captures_count = self.captures_count.copy()
        return game_copy
