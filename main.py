"""
Turkish Draughts (Dama) - Main Application

Flet-based desktop application for playing Turkish Draughts
against AI or locally with another player.
"""

import flet as ft
import asyncio
from typing import Optional

from game.types import GameSettings, Player
from game.state import GameState
from ui.theme import COLORS
from ui.menu_screen import create_menu_screen
from ui.game_screen import create_game_screen
from ui.result_screen import create_result_screen


class DamaApp:
    """
    Main application controller.
    
    Manages screen navigation and game state lifecycle.
    """
    
    def __init__(self, page: ft.Page):
        """Initialize the application."""
        self.page = page
        self.game_state: Optional[GameState] = None
        self.current_settings: Optional[GameSettings] = None
        self.timer_running: bool = False
        
        # Configure page
        self._configure_page()
        
        # Start at menu
        self.show_menu()
    
    def _configure_page(self):
        """Configure page settings."""
        self.page.title = "Dama - Turkish Draughts"
        self.page.bgcolor = COLORS["bg_dark"]
        self.page.padding = 0
        self.page.spacing = 0
        self.page.window.width = 1024
        self.page.window.height = 768
        self.page.window.min_width = 800
        self.page.window.min_height = 600
        self.page.theme_mode = ft.ThemeMode.DARK
    
    def show_menu(self):
        """Navigate to the menu screen."""
        self._stop_timer()
        self.page.controls.clear()
        
        menu = create_menu_screen(
            on_start_game=self._handle_start_game,
        )
        
        self.page.add(menu)
        self.page.update()
    
    def show_game(self):
        """Navigate to the game screen."""
        if not self.game_state:
            self.show_menu()
            return
        
        self.page.controls.clear()
        
        game_screen = create_game_screen(
            game_state=self.game_state,
            on_undo=self._handle_undo,
            on_forfeit=self._handle_forfeit,
            on_game_over=self._handle_game_over,
        )
        
        self.page.add(game_screen)
        self.page.update()
        
        # Start timer if timed game
        if self.current_settings and self.current_settings.time_limit:
            self._start_timer()
    
    def show_result(self):
        """Navigate to the result screen."""
        self._stop_timer()
        
        if not self.game_state:
            self.show_menu()
            return
        
        self.page.controls.clear()
        
        # Get stats from game state
        winner = self.game_state.get_winner()
        total_moves = len(self.game_state.get_move_history())
        captures = self.game_state.get_capture_counts()
        duration = self.game_state.get_game_duration()
        player_side = (
            self.current_settings.player_side 
            if self.current_settings else None
        )
        
        result_screen = create_result_screen(
            winner=winner,
            total_moves=total_moves,
            captures=captures,
            game_duration=duration,
            player_side=player_side,
            on_return_to_menu=self._handle_return_to_menu,
        )
        
        self.page.add(result_screen)
        self.page.update()
    
    def _handle_start_game(self, settings: GameSettings):
        """Handle game start from menu."""
        self.current_settings = settings
        self.game_state = GameState()
        self.game_state.new_game(settings)
        self.show_game()
    
    def _handle_undo(self):
        """Handle undo button press."""
        if self.game_state:
            self.game_state.undo()
            # Refresh the game screen
            self.show_game()
    
    def _handle_forfeit(self):
        """Handle forfeit button press."""
        if not self.game_state or not self.game_state.board:
            return
        
        # Set winner to opponent
        current_player = self.game_state.board.current_player
        winner = (
            Player.BLACK if current_player == Player.WHITE 
            else Player.WHITE
        )
        self.game_state.board.game_over = True
        self.game_state.board.winner = winner
        
        self.show_result()
    
    def _handle_game_over(self):
        """Handle natural game over."""
        self.show_result()
    
    def _handle_return_to_menu(self):
        """Handle return to menu from result screen."""
        self.game_state = None
        self.current_settings = None
        self.show_menu()
    
    def _start_timer(self):
        """Start the game timer."""
        if not self.timer_running:
            self.timer_running = True
            self.page.run_task(self._timer_tick)
    
    def _stop_timer(self):
        """Stop the game timer."""
        self.timer_running = False
    
    async def _timer_tick(self):
        """Timer tick coroutine - decrements active player's time."""
        while self.timer_running:
            await asyncio.sleep(1)
            
            if not self.timer_running:
                break
            
            if not self.game_state or not self.game_state.board:
                break
            
            if self.game_state.is_game_over():
                self._stop_timer()
                break
            
            # Update timer for current player
            current_player = self.game_state.board.current_player
            self.game_state.update_timer(current_player, 1)
            
            # Check for time expiry
            if self.game_state.is_time_expired(current_player):
                # Time expired - opponent wins
                winner = (
                    Player.BLACK if current_player == Player.WHITE 
                    else Player.WHITE
                )
                self.game_state.board.game_over = True
                self.game_state.board.winner = winner
                self._stop_timer()
                self.show_result()
                break
            
            # Refresh game screen to update timer display
            self.show_game()


def main(page: ft.Page):
    """Main entry point for Flet application."""
    DamaApp(page)


if __name__ == "__main__":
    ft.app(target=main)
