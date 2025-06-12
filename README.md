# Groczi Backend - Grocery Optimization Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## 📚 Project Documentation

This repository contains the backend implementation of Groczi. The frontend application is maintained in a separate repository.

### Project Documentation
- [Literature & Competitors Analysis](https://github.com/user-attachments/files/18188417/Literature.%2B.Competitors.docx)
- [Detailed Requirements Document](https://github.com/user-attachments/files/18223077/Groczi.Detailed.Requirements.docx)
- [Detailed Design Document](https://github.com/user-attachments/files/18307645/Detailed.Design.Groczi.docx)
- [Project Presentation](https://github.com/user-attachments/files/18429187/Groczi.Presentation.1.pptx)

## 🛒 Project Overview

**Groczi** is a grocery shopping optimization app that helps users save both time and money. By comparing grocery prices across nearby supermarkets in real time, Groczi identifies the most cost-effective stores for an entire shopping list. Combining dynamic pricing data, geolocation, and user-centric features.

This backend system encompasses data scraping, processing, API services, and intelligent optimization algorithms to help users find the best grocery deals across multiple stores.

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "Data Acquisition Layer"
        A[Scraper Engine<br/>Python Scripts] --> B[Raw Data Files<br/>XML/JSON]
        C[Image Scraper<br/>DuckDuckGo API] --> D[Product Images]
    end
    
    subgraph "Data Processing Layer"
        B --> E[Parser<br/>TypeScript]
        E --> F[(MySQL Database<br/>Prisma ORM)]
        D --> F
    end
    
    subgraph "Application Layer"
        F --> G[REST API<br/>Express.js]
        G --> H[Optimization Engine]
        G --> I[User Features]
    end
    
    subgraph "External Systems"
        J[Cerberus Data Provider] --> A
        K[Store Chain APIs] --> A
        L[Price Monitoring Services] --> A
    end
    
    M[Frontend Client] --> G
```

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Data Pipeline](#-data-pipeline)
- [Development](#-development)
- [Contributing](#-contributing)

## ✨ Features

### 🛒 Core Functionality
- **Multi-Store Price Comparison**: Compare prices across different grocery chains
- **Smart Cart Optimization**: Optimize shopping carts for minimum cost or maximum savings
- **Real-Time Price Tracking**: Monitor price changes and historical trends
- **Promotion Management**: Track and apply store promotions and discounts
- **User Personalization**: Bookmarks, shopping lists, and cart management

### 🔍 Data Acquisition
- **Automated Web Scraping**: Extract data from major grocery chain websites
- **Scheduled Data Updates**: Hourly data synchronization with external sources
- **Image Processing**: Automatic product and store image discovery
- **Data Validation**: Comprehensive data integrity checks and cleaning

### 🎯 Optimization Algorithms
- **Single-Store Optimization**: Find best prices within a single store
- **Multi-Store Optimization**: Optimize across multiple stores considering travel costs
- **Promotion Integration**: Factor in discounts and special offers
- **Historical Analysis**: Price trend analysis and prediction

## 🛠️ Tech Stack

### Backend Core
- **Runtime**: Node.js with TypeScript (ES Modules)
- **Framework**: Express.js 5.x
- **Database**: MySQL 8.0 with Prisma ORM
- **Authentication**: Device-based user identification

### Data Processing
- **Scraping**: Python 3.x with Selenium WebDriver
- **Parsing**: Fast XML Parser for data transformation
- **Image Search**: DuckDuckGo Images API
- **Scheduling**: Python Schedule library

### Development Tools
- **Containerization**: Docker & Docker Compose
- **Type Safety**: TypeScript with strict configuration
- **Database Migrations**: Prisma migrations
- **Code Quality**: ESModules, path mapping

### External APIs
- **OpenAI**: Advanced text processing and categorization
- **DuckDuckGo Images**: Product and store image discovery
- **Cerberus**: Israeli grocery price data provider

## 📁 Project Structure

```
Groczi/
├── backend/                    # Express.js REST API
│   ├── index.ts               # Application entry point
│   ├── config/                # Configuration files
│   └── features/              # Feature-based modules
│       ├── groceries/         # Product management
│       ├── stores/            # Store and chain management
│       ├── promotions/        # Promotion and discount handling
│       ├── bookmarks/         # User bookmark functionality
│       ├── cart/              # Shopping cart management
│       ├── lists/             # Shopping list features
│       ├── optimization/      # Price optimization algorithms
│       └── shared/            # Shared utilities and middleware
├── scraper-engine/            # Data acquisition system
│   ├── scripts/               # Scraping scripts
│   │   ├── cerberus.py        # Main data scraper
│   │   ├── shops.py           # Store information scraper
│   │   └── prices.py          # Price data scraper
│   ├── utils/                 # Scraping utilities
│   ├── configs/               # Scraper configurations
│   ├── output/                # Scraped data output
│   └── run_all_scripts.py     # Orchestration script
├── parser/                    # Data processing system
│   ├── run-parsers.ts         # Parser orchestration
│   ├── modules/               # Parser modules
│   │   ├── groceries/         # Product data parsing
│   │   ├── stores/            # Store data parsing
│   │   └── promotions/        # Promotion data parsing
│   ├── utils/                 # Parsing utilities
│   ├── constants/             # Parser constants
│   └── prisma-client/         # Database client
├── images-scraper/            # Image acquisition
│   └── find_image.py          # Image search functionality
├── prisma/                    # Database layer
│   └── schema.prisma          # Database schema definition
├── docker-compose.yml         # Container orchestration
├── package.json               # Node.js dependencies
└── tsconfig.json              # TypeScript configuration
```

## 🗄️ Database Schema

The system uses a comprehensive MySQL database schema designed for efficient grocery data management:

### Core Entities

#### Products (`grocery`)
- **Primary Key**: `itemCode` (VARCHAR(20))
- **Attributes**: Name, manufacturer, unit details, pricing, images, categories
- **Relationships**: Links to stores, promotions, user interactions

#### Stores (`stores`, `chains`, `subchains`)
- **Hierarchical Structure**: Chain → SubChain → Store
- **Geographic Data**: Coordinates, addresses, postal codes
- **Store Types**: Different retail formats and categories

#### Pricing (`store_grocery`, `store_grocery_price_history`)
- **Current Prices**: Real-time pricing per store
- **Historical Data**: Price trend tracking with timestamps
- **Discount Flags**: Promotion applicability indicators

#### User Features
- **Device Users**: Anonymous user identification
- **Bookmarks**: User product favorites
- **Shopping Carts**: Temporary shopping selections
- **Lists**: Persistent shopping lists

#### Promotions (`promotion`, `promotion_grocery`)
- **Promotion Details**: Duration, description, applicability
- **Product Mappings**: Specific product discount prices
- **Store-Specific**: Promotions tied to specific store locations

### Key Relationships
- **Many-to-Many**: Products ↔ Stores (with pricing)
- **One-to-Many**: Users → Bookmarks/Cart/Lists
- **Hierarchical**: Chains → SubChains → Stores
- **Temporal**: Price history tracking

## 🚀 Installation

### Prerequisites
- **Node.js** 18+ with npm
- **Python** 3.9+
- **MySQL** 8.0+
- **Docker** & Docker Compose (optional)

### 1. Clone Repository
```bash
git clone <repository-url>
cd Groczi
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies (recommended: use virtual environment)
pip install -r requirements.txt  # Create this file based on imports
```

### 3. Database Setup

#### Option A: Docker (Recommended)
```bash
# Start MySQL container
docker-compose up -d mysql
```

#### Option B: Local MySQL
```bash
# Create database manually
mysql -u root -p
CREATE DATABASE groczi_db;
```

### 4. Environment Configuration
Create `.env` file in the root directory:
```env
# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/groczi_db"
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_DATABASE=groczi_db
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password

# Application Configuration
PORT=3000

# External APIs (Optional)
OPENAI_API_KEY=your_openai_key
```

### 5. Database Migration
```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma db push
```

## ⚙️ Configuration

### Scraper Configuration
Configure scraping targets in `scraper-engine/configs/`:
- **cerberus.json**: Main data source configuration
- **shops.json**: Store-specific scraping rules
- **prices.json**: Price monitoring configuration

### Parser Configuration
Configure data processing in `parser/constants/`:
- File path mappings
- Data validation rules
- Processing batch sizes

## 🎯 Usage

### Starting the System

#### 1. Start Database
```bash
docker-compose up -d mysql
```

#### 2. Start Backend API
```bash
cd backend
npm start
# Server runs on http://localhost:3000
```

#### 3. Run Data Pipeline

**Manual Execution:**
```bash
# Run scrapers
npm run cerberus    # Main data scraper
npm run shops       # Store information
npm run prices      # Price updates

# Process scraped data
npm run parsers -- stores groceries promotions
```

**Automated Execution:**
```bash
# Start scheduled scraping (runs hourly)
cd scraper-engine
python run_all_scripts.py
```

### Data Pipeline Workflow

1. **Data Acquisition** (Python Scripts)
   - `cerberus.py`: Downloads latest data files from Cerberus system
   - `shops.py`: Scrapes store and chain information
   - `prices.py`: Collects current pricing data

2. **Data Processing** (TypeScript Parser)
   - Validates and cleans scraped data
   - Transforms data to database schema
   - Imports data with conflict resolution

3. **Image Enhancement** (Python Script)
   - Searches for product images using DuckDuckGo
   - Associates images with products and stores
   - Updates database with image URLs

## 📖 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints Overview

#### Stores
```http
GET /stores                          # List all stores
GET /stores/:chainId/:subChainId     # Get stores by chain
GET /stores/search?location=...      # Search stores by location
```

#### Groceries
```http
GET /groceries                       # List products with pagination
GET /groceries/:itemCode             # Get product details
GET /groceries/search?q=...          # Search products
GET /groceries/category/:category    # Products by category
```

#### Promotions
```http
GET /promotions                      # Current promotions
GET /promotions/store/:storeId       # Store-specific promotions
GET /promotions/product/:itemCode    # Product-specific promotions
```

#### User Features
```http
# Bookmarks
GET /me/bookmarks                    # User bookmarks
POST /me/bookmarks                   # Add bookmark
DELETE /me/bookmarks/:itemCode       # Remove bookmark

# Shopping Cart
GET /me/cart                         # Current cart
POST /me/cart                        # Add to cart
PUT /me/cart/:itemCode               # Update quantity
DELETE /me/cart/:itemCode            # Remove from cart

# Shopping Lists
GET /me/lists                        # User lists
POST /me/lists                       # Create list
PUT /me/lists/:listId                # Update list
DELETE /me/lists/:listId             # Delete list
```

#### Optimization
```http
POST /optimize/single-store          # Optimize for one store
POST /optimize/multi-store           # Optimize across stores
```

### Sample API Requests

#### Optimize Shopping Cart
```http
POST /optimize/multi-store
Content-Type: application/json

{
  "items": [
    { "itemCode": "1234567890123", "quantity": 2 },
    { "itemCode": "9876543210987", "quantity": 1 }
  ],
  "preferences": {
    "maxStores": 3,
    "maxTravelDistance": 10
  }
}
```

#### Search Products
```http
GET /groceries/search?q=milk&category=dairy&limit=20&page=1
```

## 🔄 Data Pipeline

### Scraping Process
1. **Authentication**: Login to data provider systems
2. **Data Discovery**: Find available data files
3. **Download**: Retrieve compressed data files
4. **Extraction**: Decompress and validate data
5. **Storage**: Save raw data for processing

### Processing Pipeline
1. **Data Validation**: Check file integrity and format
2. **Transformation**: Convert to standardized format
3. **Enrichment**: Add categories, images, and metadata
4. **Import**: Batch insert with conflict resolution
5. **Cleanup**: Remove temporary files and optimize database

### Quality Assurance
- **Data Validation**: Schema validation and business rule checks
- **Duplicate Detection**: Prevent duplicate entries
- **Error Handling**: Comprehensive logging and error recovery
- **Performance Monitoring**: Track processing times and success rates

## 🧪 Development

### Code Structure
- **Feature-Based Architecture**: Modular design with clear separation
- **TypeScript Strict Mode**: Type safety and compile-time error checking
- **ES Modules**: Modern JavaScript module system
- **Prisma ORM**: Type-safe database operations

### Database Development
```bash
# Make schema changes
# Edit prisma/schema.prisma

# Apply changes
npx prisma db push

# Generate new client
npx prisma generate
```

### Adding New Features
1. Create feature directory in `backend/features/`
2. Implement controller, service, and route modules
3. Register routes in main `index.ts`
4. Add database schema changes if needed
5. Update API documentation

### Testing
```bash
# API testing
curl -X GET http://localhost:3000/groceries

# Database testing
npx prisma studio  # Visual database browser
```

## 🤝 Contributing

### Development Guidelines
- Follow TypeScript strict mode requirements
- Use feature-based module organization
- Implement comprehensive error handling
- Add appropriate logging for debugging
- Document API changes

### Code Style
- Use ES6+ features and async/await
- Follow consistent naming conventions
- Add TypeScript types for all functions
- Use Prisma for all database operations
- Handle errors gracefully with proper HTTP status codes

## 📄 License

This project is developed as part of a final degree project. All rights reserved.


---

### 🏆 Project Highlights

This backend system demonstrates:
- **Full-Stack Integration**: Seamless connection between data acquisition, processing, and API layers
- **Scalable Architecture**: Modular design supporting future enhancements
- **Data Engineering**: Sophisticated ETL pipeline with error handling and validation
- **Real-World Application**: Practical solution for grocery price optimization
- **Modern Technologies**: Current best practices in Node.js, TypeScript, and database design

**Groczi Backend** - Transforming grocery shopping through intelligent price optimization. 🛒✨

## 🧠 Optimization Algorithms

The heart of Groczi lies in its sophisticated optimization algorithms that help users find the best grocery deals. The system implements two main optimization strategies, each designed for different shopping scenarios.

### 🏪 Single-Store Optimization Algorithm

**Purpose**: Find the best single store for your entire shopping list.

**How it works**:
1. **Location Filtering**: Find all stores within your specified distance (default 150km)
2. **Item Availability Check**: Identify which stores stock your required items
3. **Full vs Partial Match Logic**:
   - **Full Match**: Stores that have ALL items in your list (preferred)
   - **Partial Match**: Fallback to stores with some items if no full match exists
4. **Cost Calculation**: For each store, calculate:
   ```
   Total Score = Item Cost + (λ × Travel Cost)
   Travel Cost = 2 × Distance × Cost per km
   ```
5. **Ranking**: Sort stores by total score (lowest = best deal)

**Smart Features**:
- **Haversine Distance**: Accurate geographic distance calculations
- **Travel Cost Weighting**: Adjustable λ (lambda) factor to prioritize convenience vs savings
- **Partial Match Intelligence**: Never leaves you empty-handed

**Example Output**:
```json
{
  "is_partial_match": false,
  "ranked_stores": [
    {
      "store_name": "SuperMarket Plus",
      "combined_score": 45.30,
      "item_cost_at_store": 42.50,
      "travel_cost_to_store": 2.80,
      "distance_to_store_km": 1.4,
      "items_in_list": [...],
      "missing_items": []
    }
  ]
}
```

### 🛒 Multi-Store Optimization Algorithm (Dynamic Programming)

**Purpose**: Find the optimal combination of stores to minimize total cost across multiple locations.

**Algorithm Type**: Dynamic Programming with Bitmask State Compression

**How it works**:

#### Phase 1: State Space Setup
- **Items Bitmask**: Each bit represents whether an item is purchased (2^n states)
- **Stores Bitmask**: Each bit represents whether a store is visited (2^m combinations)
- **DP State**: `dp[item_mask][store_mask] = minimum_cost`

#### Phase 2: Dynamic Programming Transition
```typescript
for each current_item_mask:
  for each current_store_mask:
    for next_item_to_assign:
      for each_candidate_store:
        if (store_has_item && cost_is_better):
          update dp[new_item_mask][new_store_mask]
```

#### Phase 3: Travel Cost Optimization (TSP)
- **Problem**: Visit selected stores in optimal order
- **Solution**: Nearest Neighbor heuristic for Traveling Salesman Problem
- **Route**: User → Store₁ → Store₂ → ... → Storeₙ → User

#### Phase 4: Solution Ranking
```
Final Score = Item Costs + (λ × Travel Distance × Cost per km)
```

**Constraints Handling**:
- **Max Stores**: Limit number of stores to visit
- **Max Travel Distance**: Cap total travel distance
- **Performance**: Warns if >10 stores or >12 items (exponential complexity)

**Smart Features**:
- **Backtracking**: Reconstructs optimal item-to-store assignments
- **Top-N Solutions**: Returns multiple alternatives (default 3)
- **Geographic Intelligence**: Real-world travel cost calculations

**Example Output**:
```json
{
  "solutions": [
    {
      "assignments": {
        "SuperMarket A": {
          "items": [{"itemCode": "123", "quantity": 2, "price": 3.50}]
        },
        "Grocery World": {
          "items": [{"itemCode": "456", "quantity": 1, "price": 2.20}]
        }
      },
      "total_cost": 12.45,
      "item_cost": 9.20,
      "travel_cost": 3.25
    }
  ]
}
```

### 🔧 Supporting Algorithms

#### Haversine Distance Calculation
```typescript
// Accurate geographic distance between two points
function calculateDistance(lat1, lon1, lat2, lon2): kilometers
```
Used for:
- Store proximity filtering
- Travel cost calculations
- TSP route optimization

#### Travel Cost Optimization (TSP Nearest Neighbor)
```typescript
// Approximate solution to Traveling Salesman Problem
function optimizeTravelRoute(userLocation, storeLocations): totalDistance
```
**Process**:
1. Start at user location
2. Always visit nearest unvisited store
3. Return to user location
4. Calculate total distance

#### Bit Manipulation Utilities
```typescript
// Count number of stores in solution
function countSetBits(storeMask): numberOfStores

// Check if store is included
function isStoreIncluded(storeMask, storeIndex): boolean
```

### 📊 Algorithm Performance

| Algorithm | Time Complexity | Space Complexity | Optimal For |
|-----------|----------------|------------------|-------------|
| Single-Store | O(n × m) | O(m) | Quick decisions, single trip |
| Multi-Store DP | O(n × 2^n × m × 2^m) | O(2^n × 2^m) | Complex lists, cost optimization |
| TSP Approximation | O(m²) | O(m) | Travel route optimization |

**Performance Limits**:
- **Single-Store**: Handles 1000+ stores efficiently
- **Multi-Store**: Practical limit ~10 stores, ~12 items
- **Real-world Usage**: Optimized for typical shopping scenarios

### 🎯 Algorithm Selection Guide

**Use Single-Store When**:
- Simple shopping trips
- Convenience over maximum savings
- Large item lists (>15 items)
- Time constraints

**Use Multi-Store When**:
- Maximum cost optimization needed
- Small to medium lists (<12 items)
- Willing to visit multiple locations
- Price differences are significant

**Smart Defaults**:
- `costPerDistanceUnit`: ₪1.0 per km (adjustable for fuel costs)
- `lambdaTravel`: 1.0 (equal weight for cost vs convenience)
- `maxStoreDistance`: 150km (initial filtering radius)
