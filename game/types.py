"""
Type definitions for Turkish Draughts (Dama).

This module contains all enums, dataclasses, and type aliases used
throughout the game. Terminology follows DOMAIN.md.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


class PieceType(Enum):
    """Type of game piece."""
    MAN = 1
    KING = 2


class Player(Enum):
    """Game participant - either WHITE or BLACK."""
    WHITE = 1
    BLACK = 2


class Difficulty(Enum):
    """AI strength level - value represents minimax search depth."""
    EASY = 2
    MEDIUM = 3
    HARD = 5
    GRANDMASTER = 7


class GameMode(Enum):
    """Game mode selection."""
    AI = "ai"       # Human plays against AI
    LOCAL = "local" # Two humans on same device


@dataclass
class Piece:
    """
    Game token that moves on the board.
    
    Attributes:
        player: The player who owns this piece (WHITE or BLACK)
        type: The piece type (MAN or KING)
    """
    player: Player
    type: PieceType = PieceType.MAN


@dataclass
class Move:
    """
    Represents a move from one square to another.
    
    Attributes:
        start: Starting position as (row, col) tuple
        end: Ending position as (row, col) tuple
        captures: List of positions of captured pieces (may be empty)
    """
    start: Tuple[int, int]
    end: Tuple[int, int]
    captures: List[Tuple[int, int]] = field(default_factory=list)


@dataclass
class GameSettings:
    """
    Configuration for a game session.
    
    Attributes:
        mode: AI or LOCAL mode
        difficulty: AI difficulty level (only relevant for AI mode)
        time_limit: Time limit in seconds per player, None for untimed
        player_side: Which side the human plays (AI mode), None for random
    """
    mode: GameMode = GameMode.AI
    difficulty: Difficulty = Difficulty.MEDIUM
    time_limit: Optional[int] = None
    player_side: Optional[Player] = Player.WHITE


@dataclass
class MoveRecord:
    """
    Record of a move for history tracking.
    
    Attributes:
        move_number: Sequential move number (1, 2, 3, ...)
        player: Player who made the move
        move: The move that was made
        timestamp: Time when move was made (seconds from game start)
    """
    move_number: int
    player: Player
    move: Move
    timestamp: Optional[float] = None


@dataclass
class BoardSnapshot:
    """
    Snapshot of board state for undo functionality.
    
    Attributes:
        board: 2D list representing board state
        current_player: Whose turn it is
        captures_count: Dict of capture counts per player
    """
    board: List[List[Optional[Piece]]]
    current_player: Player
    captures_count: dict = field(default_factory=dict)
