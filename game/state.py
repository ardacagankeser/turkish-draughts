"""
GameState Manager for Turkish Draughts.

This module provides centralized state management for a game session,
coordinating board state, move history, timers, and undo functionality.
"""

import copy
import time
from typing import List, Optional

from game.types import (
    GameSettings, GameMode, Player, Difficulty, 
    Move, MoveRecord, BoardSnapshot
)
from game.board import TurkishDraughts
from game.ai import TurkishDraughtsAI


class GameState:
    """
    Centralized game state manager.
    
    Manages all game session data including board state, move history,
    timers, and undo stack. Acts as the Application layer coordinator
    between UI and Domain logic.
    
    Attributes:
        settings: Current game configuration
        board: The game board instance
        ai: AI opponent (None for LOCAL mode)
        move_history: List of all moves made
        white_time: Remaining time for white player (seconds)
        black_time: Remaining time for black player (seconds)
        undo_stack: Stack of board snapshots for undo
        game_start_time: Timestamp when game started
    """
    
    def __init__(self) -> None:
        """Initialize empty game state."""
        self.settings: Optional[GameSettings] = None
        self.board: Optional[TurkishDraughts] = None
        self.ai: Optional[TurkishDraughtsAI] = None
        self.move_history: List[MoveRecord] = []
        self.white_time: Optional[int] = None
        self.black_time: Optional[int] = None
        self.undo_stack: List[BoardSnapshot] = []
        self.game_start_time: Optional[float] = None
        self._move_counter: int = 0
    
    def new_game(self, settings: GameSettings) -> None:
        """
        Initialize a new game with given settings.
        
        Args:
            settings: Game configuration (mode, difficulty, time, side)
        """
        self.settings = settings
        self.board = TurkishDraughts()
        self.move_history = []
        self.undo_stack = []
        self._move_counter = 0
        self.game_start_time = time.time()
        
        # Initialize timer values
        if settings.time_limit:
            self.white_time = settings.time_limit
            self.black_time = settings.time_limit
        else:
            self.white_time = None
            self.black_time = None
        
        # Initialize AI for AI mode
        if settings.mode == GameMode.AI:
            # Determine AI player (opposite of human's side)
            ai_player = (
                Player.BLACK if settings.player_side == Player.WHITE 
                else Player.WHITE
            )
            self.ai = TurkishDraughtsAI(ai_player, settings.difficulty)
        else:
            self.ai = None
        
        # Save initial snapshot for potential undo
        self.save_snapshot()
    
    def execute_move(self, move: Move) -> bool:
        """
        Execute a move and update game state.
        
        Args:
            move: The move to execute
            
        Returns:
            True if move was successful, False otherwise
        """
        if not self.board:
            return False
        
        # Save snapshot before move for undo
        self.save_snapshot()
        
        # Record current player before move
        current_player = self.board.current_player
        
        # Execute the move
        success = self.board.make_move(move)
        
        if success:
            self._move_counter += 1
            
            # Calculate timestamp
            timestamp = None
            if self.game_start_time:
                timestamp = time.time() - self.game_start_time
            
            # Record move in history
            record = MoveRecord(
                move_number=self._move_counter,
                player=current_player,
                move=move,
                timestamp=timestamp
            )
            self.move_history.append(record)
        
        return success
    
    def undo(self) -> bool:
        """
        Undo the last move(s).
        
        In AI mode, undoes 2 moves (player's move + AI's response).
        In LOCAL mode, undoes 1 move.
        
        Returns:
            True if undo was successful, False if nothing to undo
        """
        if not self.board or not self.undo_stack:
            return False
        
        # Determine how many moves to undo
        moves_to_undo = 1
        if self.settings and self.settings.mode == GameMode.AI:
            # In AI mode, undo both AI's move and player's move
            # But only if there are at least 2 snapshots
            if len(self.undo_stack) >= 2:
                moves_to_undo = 2
        
        # Restore from snapshot
        for _ in range(moves_to_undo):
            if not self.undo_stack:
                break
            
            snapshot = self.undo_stack.pop()
            self._restore_snapshot(snapshot)
            
            # Remove corresponding move from history
            if self.move_history:
                self.move_history.pop()
                self._move_counter = max(0, self._move_counter - 1)
        
        return True
    
    def save_snapshot(self) -> None:
        """Save current board state for undo functionality."""
        if not self.board:
            return
        
        snapshot = BoardSnapshot(
            board=copy.deepcopy(self.board.board),
            current_player=self.board.current_player,
            captures_count=self.board.captures_count.copy()
        )
        self.undo_stack.append(snapshot)
        
        # Limit undo stack size to prevent memory issues
        max_undo_depth = 20
        if len(self.undo_stack) > max_undo_depth:
            self.undo_stack = self.undo_stack[-max_undo_depth:]
    
    def _restore_snapshot(self, snapshot: BoardSnapshot) -> None:
        """Restore board from snapshot."""
        if not self.board:
            return
        
        self.board.board = copy.deepcopy(snapshot.board)
        self.board.current_player = snapshot.current_player
        self.board.captures_count = snapshot.captures_count.copy()
        self.board.game_over = False
        self.board.winner = None
    
    def get_move_history(self) -> List[MoveRecord]:
        """
        Get the list of all moves made in the game.
        
        Returns:
            List of MoveRecord objects
        """
        return self.move_history.copy()
    
    def is_game_over(self) -> bool:
        """
        Check if the game has ended.
        
        Returns:
            True if game is over, False otherwise
        """
        if not self.board:
            return False
        return self.board.game_over
    
    def get_winner(self) -> Optional[Player]:
        """
        Get the winner of the game.
        
        Returns:
            Winner player, or None if game not over or draw
        """
        if not self.board:
            return None
        return self.board.winner
    
    def get_current_player(self) -> Optional[Player]:
        """
        Get the player whose turn it is.
        
        Returns:
            Current player, or None if no game active
        """
        if not self.board:
            return None
        return self.board.current_player
    
    def is_ai_turn(self) -> bool:
        """
        Check if it's the AI's turn.
        
        Returns:
            True if AI should move, False otherwise
        """
        if not self.ai or not self.board:
            return False
        return self.board.current_player == self.ai.player
    
    def get_ai_move(self) -> Optional[Move]:
        """
        Get the AI's best move for current position.
        
        Returns:
            Best move found by AI, or None if not AI's turn
        """
        if not self.is_ai_turn():
            return None
        return self.ai.get_best_move(self.board)
    
    def get_game_duration(self) -> float:
        """
        Get elapsed game time in seconds.
        
        Returns:
            Seconds since game started
        """
        if not self.game_start_time:
            return 0.0
        return time.time() - self.game_start_time
    
    def get_capture_counts(self) -> dict:
        """
        Get capture counts for each player.
        
        Returns:
            Dict with Player keys and capture counts
        """
        if not self.board:
            return {Player.WHITE: 0, Player.BLACK: 0}
        return self.board.captures_count.copy()
    
    def update_timer(self, player: Player, elapsed_seconds: float) -> None:
        """
        Update a player's remaining time.
        
        Args:
            player: Which player's timer to update
            elapsed_seconds: Seconds to subtract
        """
        if player == Player.WHITE and self.white_time is not None:
            self.white_time = max(0, self.white_time - elapsed_seconds)
        elif player == Player.BLACK and self.black_time is not None:
            self.black_time = max(0, self.black_time - elapsed_seconds)
    
    def is_time_expired(self, player: Player) -> bool:
        """
        Check if a player's time has expired.
        
        Args:
            player: Player to check
            
        Returns:
            True if time expired, False otherwise
        """
        if player == Player.WHITE:
            return self.white_time is not None and self.white_time <= 0
        else:
            return self.black_time is not None and self.black_time <= 0
